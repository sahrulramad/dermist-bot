/**
 * Discord HTTP Interactions Route — Serverless Discord Bot Handler
 * POST /interactions
 */

import { Hono } from 'hono';
import { verifyKey, InteractionType, InteractionResponseType } from 'discord-interactions';
import { simpleAsk, translate } from '../services/ai.js';
import { getFacts, addFact } from '../services/memory.js';

const interactionsRoute = new Hono();

// Helper: Edit deferred message di Discord
async function editOriginalReply(applicationId, token, payload) {
  const url = `https://discord.com/api/v10/webhooks/${applicationId}/${token}/messages/@original`;
  try {
    await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error('[Discord Webhook Patch Error]', err.message);
  }
}

// ─── POST /interactions Handler ───
interactionsRoute.post('/', async (c) => {
  const signature = c.req.header('x-signature-ed25519');
  const timestamp = c.req.header('x-signature-timestamp');
  const rawBody = await c.req.text();
  const publicKey = c.env.DISCORD_PUBLIC_KEY;

  if (!signature || !timestamp || !publicKey) {
    return c.text('Unauthorized', 401);
  }

  // Verifikasi ed25519 signature
  const isValid = await verifyKey(rawBody, signature, timestamp, publicKey);
  if (!isValid) {
    return c.text('Bad request signature', 401);
  }

  const interaction = JSON.parse(rawBody);

  // ─── 1. PING (Verifikasi awal dari Discord Developer Portal) ───
  if (interaction.type === InteractionType.PING) {
    return c.json({ type: InteractionResponseType.PONG });
  }

  // ─── 2. APPLICATION COMMAND (Slash Commands) ───
  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    const { name, options } = interaction.data;
    const userId = interaction.member?.user?.id || interaction.user?.id;
    const userName = interaction.member?.user?.username || interaction.user?.username || 'User';
    const guildId = interaction.guild_id || 'global';
    const appId = interaction.application_id;
    const token = interaction.token;

    // ── Command: /ping ──
    if (name === 'ping') {
      return c.json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          embeds: [
            {
              title: '🏓 Pong! Dermist Serverless Online',
              description:
                '• **Runtime:** Cloudflare Workers (Global Edge)\n' +
                '• **Status:** 24/7 Aktif tanpa laptop menyala\n' +
                '• **Model:** Meta Llama 3.3 70B Instruct (Workers AI)',
              color: 0x57f287,
            },
          ],
        },
      });
    }

    // ── Command: /help ──
    if (name === 'help') {
      return c.json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          embeds: [
            {
              title: '📖 Buku Panduan Dermist — Serverless Cloudflare Edition',
              description:
                'Halo! Dermist berjalan **24/7 di Cloudflare Workers Edge** secara serverless tanpa bergantung pada komputer lokal.\n\nDaftar perintah yang tersedia:',
              fields: [
                {
                  name: '🤖 AI Assistant',
                  value:
                    '• `/ask <pertanyaan>` — Tanya AI Llama 3.3 70B (didukung memori server & fakta)\n' +
                    '• `/translate <teks> <bahasa>` — Terjemahkan bahasa otomatis',
                },
                {
                  name: '🧠 Smart Memory (Memo)',
                  value:
                    '• `/memo add <teks> [kategori]` — Simpan preferensi kamu\n' +
                    '• `/memo list [kategori]` — Lihat daftar memo kamu\n' +
                    '• `/memo search <query>` — Cari catatan memomu\n' +
                    '• `/memo delete <nomor>` — Hapus catatan memo\n' +
                    '• `/memo server-add <teks>` — Simpan aturan / info server agar AI tahu\n' +
                    '• `/facts` — Ringkasan apa yang diingat bot tentangmu\n' +
                    '• `/remember <fakta>` — Simpan fakta khusus tentang dirimu',
                },
                {
                  name: 'ℹ️ Utilitas',
                  value: '• `/ping` — Cek status serverless bot\n• `/help` — Menampilkan bantuan ini',
                },
              ],
              color: 0x5865f2,
              footer: { text: 'Dermist Bot • 100% Serverless on Cloudflare' },
            },
          ],
        },
      });
    }

    // ── Command: /facts ──
    if (name === 'facts') {
      const facts = await getFacts(c.env.KV, userId);
      if (!facts.length) {
        return c.json({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `Aku belum punya catatan fakta tentang kamu. Coba pakai \`/remember <fakta>\` atau mengobrol denganku!`,
          },
        });
      }

      const list = facts.map((f, i) => `${i + 1}. ${f.text}`).join('\n');
      return c.json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          embeds: [
            {
              title: `🧠 Yang Aku Ingat Tentang ${userName}`,
              description: list,
              color: 0x5865f2,
            },
          ],
        },
      });
    }

    // ── Command: /remember ──
    if (name === 'remember') {
      const fact = options?.find((o) => o.name === 'fakta')?.value;
      if (!fact) {
        return c.json({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: { content: 'Tolong masukkan fakta yang ingin diingat.' },
        });
      }

      await addFact(c.env.KV, userId, userName, fact);
      return c.json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          embeds: [
            {
              title: '✅ Fakta Tersimpan!',
              description: `Aku akan mengingat ini tentangmu:\n> "${fact}"`,
              color: 0x57f287,
            },
          ],
        },
      });
    }

    // ── Command: /memo ──
    if (name === 'memo') {
      const sub = options?.[0]?.name;
      const subOpts = options?.[0]?.options || [];
      const memoKey = `memo:${guildId}:${userId}`;
      const serverMemoKey = `memo:${guildId}:global`;

      // /memo add
      if (sub === 'add') {
        const text = subOpts.find((o) => o.name === 'teks')?.value;
        const category = subOpts.find((o) => o.name === 'kategori')?.value || 'general';
        let memos = (await c.env.KV.get(memoKey, 'json')) || [];
        memos.push({ text, category, createdAt: Date.now() });
        await c.env.KV.put(memoKey, JSON.stringify(memos));

        return c.json({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            embeds: [
              {
                title: '📝 Memo Tersimpan',
                description: `**Kategori:** \`${category}\`\n**Isi:** ${text}`,
                color: 0x57f287,
              },
            ],
          },
        });
      }

      // /memo server-add
      if (sub === 'server-add') {
        const text = subOpts.find((o) => o.name === 'teks')?.value;
        let memos = (await c.env.KV.get(serverMemoKey, 'json')) || [];
        memos.push({ text, by: userName, createdAt: Date.now() });
        await c.env.KV.put(serverMemoKey, JSON.stringify(memos));

        return c.json({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            embeds: [
              {
                title: '🏛️ Memo Server Tersimpan',
                description: `Informasi server telah dicatat dan sekarang dipahami oleh AI:\n> ${text}`,
                color: 0x5865f2,
              },
            ],
          },
        });
      }

      // /memo list
      if (sub === 'list') {
        const category = subOpts.find((o) => o.name === 'kategori')?.value;
        let memos = (await c.env.KV.get(memoKey, 'json')) || [];
        if (category) {
          memos = memos.filter((m) => m.category?.toLowerCase() === category.toLowerCase());
        }

        if (!memos.length) {
          return c.json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: 'Belum ada memo yang tersimpan.' },
          });
        }

        const lines = memos.map((m, i) => `**${i + 1}.** [${m.category || 'general'}] ${m.text}`).join('\n');
        return c.json({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            embeds: [
              {
                title: `📋 Daftar Memo ${userName}`,
                description: lines,
                color: 0x5865f2,
              },
            ],
          },
        });
      }

      // /memo delete
      if (sub === 'delete') {
        const num = subOpts.find((o) => o.name === 'nomor')?.value;
        let memos = (await c.env.KV.get(memoKey, 'json')) || [];
        const idx = parseInt(num) - 1;
        if (isNaN(idx) || idx < 0 || idx >= memos.length) {
          return c.json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: `Nomor memo tidak valid. Pilih antara 1 sampai ${memos.length}.` },
          });
        }

        const deleted = memos.splice(idx, 1)[0];
        await c.env.KV.put(memoKey, JSON.stringify(memos));
        return c.json({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: { content: `✅ Memo nomor ${num} ("${deleted.text}") berhasil dihapus.` },
        });
      }

      // /memo search
      if (sub === 'search') {
        const q = (subOpts.find((o) => o.name === 'query')?.value || '').toLowerCase();
        let userMemos = (await c.env.KV.get(memoKey, 'json')) || [];
        let serverMemos = (await c.env.KV.get(serverMemoKey, 'json')) || [];

        const matches = [
          ...userMemos.filter((m) => m.text?.toLowerCase().includes(q)),
          ...serverMemos.filter((m) => m.text?.toLowerCase().includes(q)),
        ];

        if (!matches.length) {
          return c.json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: `Tidak ada memo yang cocok dengan kata kunci: **"${q}"**.` },
          });
        }

        const lines = matches.map((m, i) => `**${i + 1}.** ${m.text}`).join('\n');
        return c.json({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            embeds: [
              {
                title: `🔍 Hasil Pencarian Memo: "${q}"`,
                description: lines,
                color: 0x5865f2,
              },
            ],
          },
        });
      }
    }

    // ── Command: /translate ──
    if (name === 'translate') {
      const text = options?.find((o) => o.name === 'teks')?.value;
      const lang = options?.find((o) => o.name === 'bahasa')?.value || 'English';

      c.executionCtx.waitUntil(
        (async () => {
          try {
            const result = await translate(c.env.AI, text, lang);
            await editOriginalReply(appId, token, {
              embeds: [
                {
                  title: `🌐 Terjemahan (${lang})`,
                  description: result,
                  fields: [{ name: 'Teks Asli', value: text }],
                  color: 0x5865f2,
                },
              ],
            });
          } catch (err) {
            await editOriginalReply(appId, token, {
              content: `Gagal menerjemahkan: ${err.message}`,
            });
          }
        })()
      );

      return c.json({ type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE });
    }

    // ── Command: /ask ──
    if (name === 'ask') {
      const question = options?.find((o) => o.name === 'pertanyaan')?.value;

      c.executionCtx.waitUntil(
        (async () => {
          try {
            // Ambil memori personal & memo server dari KV
            const [facts, userMemos, serverMemos] = await Promise.all([
              getFacts(c.env.KV, userId),
              c.env.KV.get(`memo:${guildId}:${userId}`, 'json'),
              c.env.KV.get(`memo:${guildId}:global`, 'json'),
            ]);

            let contextText = '';
            if (facts?.length) {
              contextText += `\n[Fakta User]:\n` + facts.map((f) => `- ${f.text}`).join('\n');
            }
            if (userMemos?.length) {
              contextText += `\n[Memo User]:\n` + userMemos.map((m) => `- ${m.text}`).join('\n');
            }
            if (serverMemos?.length) {
              contextText += `\n[Info/Aturan Server]:\n` + serverMemos.map((m) => `- ${m.text}`).join('\n');
            }

            const systemPrompt =
              `Kamu adalah Dermist, asisten AI cerdas di Discord. Jawab dengan ramah, informatif, dan ringkas.` +
              (contextText ? `\n\nKonteks Memori:\n${contextText}` : '') +
              `\nGunakan bahasa yang sama dengan pertanyaan user.`;

            const answer = await simpleAsk(c.env.AI, question, systemPrompt);
            const truncated = answer.length > 1900 ? answer.slice(0, 1900) + '...' : answer;

            await editOriginalReply(appId, token, {
              embeds: [
                {
                  title: '💬 AI Menjawab',
                  description: truncated,
                  color: 0x5865f2,
                  footer: { text: `Ditanyakan oleh ${userName} • Llama 3.3 70B` },
                },
              ],
            });
          } catch (err) {
            console.error('[Ask Error]', err);
            await editOriginalReply(appId, token, {
              content: `Maaf, terjadi kesalahan saat memproses jawaban: ${err.message}`,
            });
          }
        })()
      );

      // Balas segera ke Discord bahwa AI sedang berpikir
      return c.json({ type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE });
    }

    // Fallback untuk command lainnya
    return c.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: `Perintah \`/${name}\` diterima oleh Dermist Serverless Worker.` },
    });
  }

  return c.text('Unhandled interaction type', 400);
});

export { interactionsRoute };
