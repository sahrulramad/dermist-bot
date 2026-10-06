import { config } from '../config.js';
import { log } from './logger.js';
import { getToolSchemas, isDestructive, isModerationTool, isInformationalTool, executeTool } from './tools.js';
import { notifyModerationAction } from './notifier.js';
import { workerChat } from './worker-client.js';

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
  const userDisplay = ctx?.userDisplayName || ctx?.message?.member?.displayName || userName;
  const userAuthorId = ctx?.message?.author?.id || 'unknown';

  let toolCalls = [];
  let textResponse = '';

  if (config.workerBaseUrl) {
    try {
      const workerRes = await workerChat({
        userMessage,
        userName,
        userId: ctx?.message?.author?.id,
        serverContext: server,
        persona,
        skills,
        triggerReason: ctx?.triggerReason,
      });

      if (workerRes && !workerRes.error) {
        textResponse = workerRes.reply || '';
        toolCalls = workerRes.toolCalls || [];
      }
    } catch (err) {
      log(`Worker chat error, falling back to direct AI: ${err.message}`, 'warning');
    }
  }

  // Fallback ke direct Cloudflare AI jika Worker tidak diset atau tidak merespons
  if (!textResponse && toolCalls.length === 0) {
    const systemPrompt = `Kamu adalah Dermist, asisten AI ramah, cerdas, dan santai di server Discord. Kamu punya kepribadian yang asik, solutif, dan mengerti seluruh konteks server.${persona}${skills}${facts}${server}

ATURAN PENTING:
- User saat ini: ${userDisplay} (username: @${userName}, ID: ${userAuthorId}).
- PANGGIL USER DENGAN NAMA TAMPILANNYA: "${userDisplay}" (JANGAN panggil dengan username teknis @${userName} kecuali diminta).
- JAWAB PERTANYAAN USER SECARA SPESIFIK & RELEVAN:
  * Jika user bertanya tentang dirinya ("gua siapa", "kenal gua gak"), jawab bahwa dia adalah ${userDisplay} dan status/role-nya di server (misal Owner).
  * Jika user bertanya tentang anggota/member server ("lu tau member member kita gak", "siapa aja member di sini", dll), sebutkan nama-nama member yang ada di server berdasarkan <data_server> atau panggil tool get_server_members! JANGAN malah mengulang-ulang jawaban bahwa user adalah owner.
- Kamu BOLEH memanggil tools jika butuh data lebih lanjut atau aksi moderasi:
  * get_member_info: untuk cek detail 1 orang member.
  * get_server_members: untuk cek daftar seluruh member di server.
  * kick_member, mute_member, warn_member, purge_messages: untuk aksi moderasi otomatis.
- Gaya bicara: Bahasa Indonesia gaul/santai, akrab, ramah, dan solutif.`;

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
    toolCalls = result.tool_calls || [];
    textResponse = result.response || '';
  }

  if (!toolCalls || toolCalls.length === 0) {
    return { reply: textResponse || '(tidak ada jawaban)', pendingAction: false };
  }

  const executedResults = [];
  const rawResults = [];
  let hasInfoTool = false;

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
      rawResults.push(`[${toolName}]: ${toolResult}`);

      if (isInformationalTool(toolName)) {
        hasInfoTool = true;
      }

      if (isModerationTool(toolName)) {
        const target = args.userId ? `<@${String(args.userId).replace(/[<@!>]/g, '')}>` : args.channelId ?? 'N/A';
        await notifyModerationAction(ctx.guild, toolResult, {
          toolName,
          target,
          reason: args.reason ?? (ctx.triggerReason ?? 'AI decision'),
          result: toolResult,
          auto: true,
        });
      }
    } catch (err) {
      log(`Tool error: ${toolName}: ${err.message}`, 'error');
      executedResults.push(`❌ ${toolName}: ${err.message}`);
      rawResults.push(`[${toolName} error]: ${err.message}`);
    }
  }

  // Jika tool berupa info (seperti get_member_info, get_server_members) ATAU belum ada balasan kalimat conversational:
  // Buat conversational follow-up agar AI merangkai jawaban ramah & natural berdasarkan hasil tool!
  if (hasInfoTool || !textResponse) {
    try {
      const followUpMessages = [
        {
          role: 'system',
          content: `Kamu adalah Dermist, asisten AI Discord yang santai, cerdas, bersahabat, dan seru.${persona}${skills}
Gunakan hasil data eksekusi tool di bawah untuk menjawab pesan user secara natural dan mengalir dalam bahasa Indonesia.
PANGGIL USER DENGAN NAMA TAMPILANNYA: "${userDisplay}" (JANGAN panggil dengan username teknis @${userName}).
JANGAN tampilkan raw debug/JSON atau format mentah tool. Jawab secara tepat, to-the-point, dan relevan apa yang ditanyakan user!
User saat ini: ${userDisplay} (username: @${userName}).`,
        },
        { role: 'user', content: userMessage },
        {
          role: 'user',
          content: `[Hasil Eksekusi Tool:\n${rawResults.join('\n')}\n]\nBerikan jawaban ramah, santai, dan relevan untuk pertanyaan user di atas:`,
        },
      ];

      const res = await fetch(`${API_BASE}/${config.cfAccountId}/ai/run/${TEXT_MODEL}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.cfApiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages: followUpMessages }),
      });

      const data = await res.json();
      if (data.success && (data.result?.response || data.result?.choices?.[0]?.message?.content)) {
        const aiFinalReply = data.result.response || data.result.choices[0].message.content;
        return { reply: aiFinalReply.trim(), pendingAction: false };
      }
    } catch (err) {
      log(`Follow-up conversational AI error: ${err.message}`, 'warning');
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
