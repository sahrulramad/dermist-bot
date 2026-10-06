/**
 * Chat Route — AI Agent dengan tool calling
 * POST /api/chat
 */

import { Hono } from 'hono';
import { chatCompletion } from '../services/ai.js';
import { getHistory, addHistory, getFacts } from '../services/memory.js';

const chatRoute = new Hono();

// Tool schemas (sama dengan yang ada di bot, tapi portable)
const TOOL_SCHEMAS = [
  {
    type: 'function',
    function: {
      name: 'kick_member',
      description: 'Kick member dari server.',
      parameters: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID atau @mention' },
          reason: { type: 'string', description: 'Alasan kick' },
        },
        required: ['userId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ban_member',
      description: 'Ban member dari server. DESTRUKTIF — butuh konfirmasi user.',
      parameters: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID atau @mention' },
          reason: { type: 'string', description: 'Alasan ban' },
          deleteMessageDays: { type: 'number', description: 'Hapus pesan X hari (0-7)' },
        },
        required: ['userId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'mute_member',
      description: 'Timeout/mute member.',
      parameters: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID atau @mention' },
          duration: { type: 'string', description: "Durasi: '60s', '5m', '1h', '1d'" },
          reason: { type: 'string', description: 'Alasan mute' },
        },
        required: ['userId', 'duration'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'unmute_member',
      description: 'Hapus timeout member.',
      parameters: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID atau @mention' },
        },
        required: ['userId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'warn_member',
      description: 'Beri peringatan ke member.',
      parameters: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID atau @mention' },
          reason: { type: 'string', description: 'Alasan warning' },
        },
        required: ['userId', 'reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'purge_messages',
      description: 'Hapus sejumlah pesan terbaru di channel.',
      parameters: {
        type: 'object',
        properties: {
          count: { type: 'number', description: 'Jumlah pesan (1-100)' },
        },
        required: ['count'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_member_info',
      description: 'Ambil info lengkap member Discord (username, nickname, roles, join date, status owner/admin). Masukkan ID, @mention, username, nickname, atau kosongkan / isi "me"/"gua" untuk info user yang sedang berbicara.',
      parameters: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID, @mention, username/nickname, atau "me"/"gua" untuk info diri sendiri' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_server_members',
      description: 'Ambil daftar seluruh member di server ini (nama display, username, status online/offline, role, bot vs manusia). Gunakan saat user bertanya tentang siapa saja member di server, ada siapa saja, atau "member-member kita".',
      parameters: {
        type: 'object',
        properties: {
          filter: { type: 'string', enum: ['all', 'humans', 'bots'], description: 'Filter tipe member' },
        },
      },
    },
  },
];

const DESTRUCTIVE_TOOLS = ['ban_member', 'delete_channel'];

chatRoute.post('/', async (c) => {
  const { userMessage, userName, userId, serverContext, persona, skills, triggerReason } = await c.req.json();

  if (!userMessage || !userName) {
    return c.json({ error: 'userMessage and userName required' }, 400);
  }

  const kv = c.env.KV;
  const ai = c.env.AI;

  // Build context
  const history = userId ? await getHistory(kv, userId) : [];
  const facts = userId ? await getFacts(kv, userId) : [];

  const factsBlock = facts.length
    ? `\n\n<memory>\nFakta yang kamu ingat tentang user ini:\n${facts.map((f) => `- ${f.text}`).join('\n')}\n</memory>`
    : '';

  const personaBlock = persona ? `\n\n<persona>\n${persona}\n</persona>` : '';
  const skillsBlock = skills ? `\n\n<skills>\n${skills}\n</skills>` : '';
  const serverBlock = serverContext ? `\n\n<data_server>\n${serverContext}\n</data_server>` : '';
  const triggerBlock = triggerReason ? `\n\n<context_trigger>\n${triggerReason}\n</context_trigger>` : '';

  const systemPrompt = `Kamu adalah Dermist, asisten AI SE-OTONOM di server Discord. Kamu bisa mengambil tindakan moderasi sendiri menggunakan tools.${personaBlock}${skillsBlock}${factsBlock}${serverBlock}${triggerBlock}

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
  const userMsg = triggerReason ? `${userMessage}\n\n[Trigger: ${triggerReason}]` : userMessage;
  messages.push({ role: 'user', content: userMsg });

  try {
    const { response, toolCalls } = await chatCompletion(ai, {
      messages,
      tools: TOOL_SCHEMAS,
    });

    // Simpan history
    if (userId) {
      await addHistory(kv, userId, 'user', userMessage);
      await addHistory(kv, userId, 'assistant', response || '(tool call)');
    }

    // Classify tool calls
    const actions = toolCalls.map((tc) => ({
      name: tc.name,
      arguments: tc.arguments || {},
      destructive: DESTRUCTIVE_TOOLS.includes(tc.name),
    }));

    return c.json({
      reply: response || '',
      toolCalls: actions,
      hasDestructive: actions.some((a) => a.destructive),
    });
  } catch (err) {
    console.error('[Chat Error]', err.message);
    return c.json({ error: err.message }, 500);
  }
});

export { chatRoute };
