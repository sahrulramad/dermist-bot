import { config } from '../config.js';
import { log } from './logger.js';
import { getToolSchemas, isDestructive, executeTool } from './tools.js';
import { notifyModerationAction } from './notifier.js';

const API_BASE = 'https://api.cloudflare.com/client/v4/accounts';
const TEXT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

const pendingActions = new Map();

export function hasPendingAction(chatId) {
  const action = pendingActions.get(chatId);
  if (!action) return false;
  if (Date.now() > action.expiresAt) {
    pendingActions.delete(chatId);
    return false;
  }
  return true;
}

export function getPendingAction(chatId) {
  return pendingActions.get(chatId) || null;
}

export function clearPendingAction(chatId) {
  pendingActions.delete(chatId);
}

export function setPendingAction(chatId, action) {
  pendingActions.set(chatId, { ...action, expiresAt: Date.now() + 60000 });
}

export async function runAgent(userMessage, userName, contextBlocks, ctx) {
  const { persona = '', skills = '', facts = '', server = '', history = [] } = contextBlocks;
  const toolSchemas = getToolSchemas();

  const systemPrompt = `Kamu adalah Dermist, asisten AI SE-OTONOM di server Discord. Kamu bisa mengambil tindakan moderasi sendiri menggunakan tools.${persona}${skills}${facts}${server}

ATURAN PENTING:
- Kamu BOLEH memanggil tools untuk kick, mute, warn, purge OTOMATIS tanpa konfirmasi.
- Untuk BAN dan DELETE CHANNEL, kamu tetap bisa memanggil tool-nya, tapi bot akan minta konfirmasi user dulu.
- Gunakan get_member_info untuk cari info member sebelum mengambil tindakan.
- Jangan mengarang informasi. Gunakan data server yang diberikan.
- Jika user sebut nama (bukan ID), cari member berdasarkan username di data server, lalu pakai ID-nya.
- Ambil keputusan dengan bijak. Mute dulu untuk pelanggaran ringan, kick untuk menengah, ban untuk berat.
- Jawab singkat dan jelas. Jelaskan tindakan yang kamu ambil.
Nama user: ${userName}.`;

  const messages = [{ role: 'system', content: systemPrompt }];
  for (const h of history) {
    messages.push({ role: h.role, content: h.content });
  }
  messages.push({ role: 'user', content: userMessage });

  const res = await fetch(`${API_BASE}/${config.cfAccountId}/ai/run/${TEXT_MODEL}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.cfApiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messages, tools: toolSchemas }),
  });

  const data = await res.json();
  if (!data.success) {
    const errMsg = data.errors?.map((e) => e.message).join(', ') || 'Unknown error';
    throw new Error(`AI error: ${errMsg}`);
  }

  const result = data.result;
  const toolCalls = result.tool_calls;
  const textResponse = result.response || '';

  if (!toolCalls || toolCalls.length === 0) {
    return { reply: textResponse || '(tidak ada jawaban)', pendingAction: false };
  }

  const executedResults = [];
  for (const tc of toolCalls) {
    const toolName = tc.name;
    const args = tc.arguments || {};
    const destructive = isDestructive(toolName);

    if (destructive) {
      setPendingAction(ctx.chatId, { toolName, args });
      const actionText = describeAction(toolName, args);
      return { reply: `⚠️ **Perlu Konfirmasi**\nAku mau ${actionText}.\nKetik **ya** dalam 60 detik untuk konfirmasi, atau abaikan untuk batal.`, pendingAction: true };
    }

    try {
      const toolResult = await executeTool(toolName, args, ctx);
      log(`Tool dieksekusi: ${toolName} → ${toolResult.slice(0, 80)}`, 'success');
      executedResults.push(`✅ ${toolResult}`);

      const target = args.userId ? `<@${String(args.userId).replace(/[<@!>]/g, '')}>` : args.channelId ?? 'N/A';
      await notifyModerationAction(ctx.guild, toolResult, {
        toolName,
        target,
        reason: args.reason ?? (ctx.triggerReason ?? 'AI decision'),
        result: toolResult,
        auto: true,
      });
    } catch (err) {
      log(`Tool error: ${toolName}: ${err.message}`, 'error');
      executedResults.push(`❌ ${toolName}: ${err.message}`);
    }
  }

  const summary = executedResults.join('\n');
  const reply = textResponse ? `${textResponse}\n\n${summary}` : summary;
  return { reply, pendingAction: false };
}

export async function executePendingAction(chatId, ctx) {
  const action = getPendingAction(chatId);
  if (!action) return null;
  clearPendingAction(chatId);

  try {
    const result = await executeTool(action.toolName, action.args, ctx);
    log(`Pending action dieksekusi: ${action.toolName}`, 'success');
    return `✅ Dikonfirmasi & dieksekusi: ${result}`;
  } catch (err) {
    log(`Pending action error: ${err.message}`, 'error');
    return `❌ Gagal: ${err.message}`;
  }
}

function describeAction(toolName, args) {
  switch (toolName) {
    case 'ban_member':
      return `**ban** <@${cleanId(args.userId)}>${args.reason ? ` karena "${args.reason}"` : ''}`;
    case 'delete_channel':
      return `**hapus channel** ${args.channelId}`;
    default:
      return `menjalankan **${toolName}**`;
  }
}

function cleanId(raw) {
  return String(raw || '').replace(/[<@!>]/g, '').trim();
}
