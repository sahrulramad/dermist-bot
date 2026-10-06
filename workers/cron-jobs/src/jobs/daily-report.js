/**
 * Daily Report Job
 * 
 * Setiap hari jam 08:00 WIB (01:00 UTC), kirim laporan lengkap ke admin channel:
 * - Member join/leave
 * - Pelanggaran (spam, toxic, warn, mute, kick, ban)
 * - Top active members
 * - AI-generated summary & rekomendasi
 */

import { KV_KEYS, DISCORD_API_BASE, TEXT_MODEL } from '../../../../shared/constants.js';

export async function dailyReport(env) {
  const kv = env.KV;
  const ai = env.AI;
  const botToken = env.DISCORD_BOT_TOKEN;
  const guildId = env.DISCORD_GUILD_ID;

  if (!botToken || !guildId) {
    console.warn('[DAILY REPORT] Token atau Guild ID belum di-set');
    return;
  }

  console.log('[JOB] Daily Report — mulai');

  // Ambil stats kemarin
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const statsKey = `${KV_KEYS.DAILY_STATS}${guildId}:${yesterday}`;
  const stats = await kv.get(statsKey, 'json');

  // Ambil admin channel
  const botChannels = await kv.get(KV_KEYS.BOT_CHANNELS, 'json');
  if (!botChannels?.adminChannelId) {
    console.warn('[DAILY REPORT] Admin channel belum di-setup');
    return;
  }

  // Kalau tidak ada stats, kirim report minimal
  if (!stats) {
    await sendReport(botToken, botChannels.adminChannelId, {
      title: `📊 Laporan Harian — ${yesterday}`,
      description: 'Tidak ada data aktivitas tercatat untuk hari ini.',
      color: 0x5865f2,
    });
    console.log('[JOB] Daily Report — selesai (no data)');
    return;
  }

  // Generate AI summary
  let aiSummary = '';
  try {
    const statsText = `
Server stats untuk ${yesterday}:
- Member join: ${stats.membersJoined}
- Member leave: ${stats.membersLeft}
- Total pesan: ${stats.messagesTotal}
- Warning: ${stats.warningsIssued}
- Mute: ${stats.mutesIssued}
- Kick: ${stats.kicksIssued}
- Ban: ${stats.bansIssued}
- Spam terdeteksi: ${stats.spamDetected}
- Toxic terdeteksi: ${stats.toxicDetected}
- Raid attempts: ${stats.raidAttempts}
`;

    const result = await ai.run(TEXT_MODEL, {
      messages: [
        {
          role: 'system',
          content: `Kamu adalah analis server Discord. Berikan ringkasan singkat (2-3 paragraf, bahasa Indonesia casual) dari stats harian berikut. Sorot hal yang perlu perhatian admin (jika ada pelanggaran tinggi, member loss, dll). Berikan 1-2 rekomendasi actionable. Jangan gunakan markdown heading.`,
        },
        { role: 'user', content: statsText },
      ],
    });
    aiSummary = result.response || '';
  } catch (err) {
    console.error('[DAILY REPORT] AI summary error:', err.message);
    aiSummary = '_Gagal generate AI summary_';
  }

  // Buat embed
  const netGrowth = stats.membersJoined - stats.membersLeft;
  const growthEmoji = netGrowth > 0 ? '📈' : netGrowth < 0 ? '📉' : '➡️';
  const totalViolations = stats.warningsIssued + stats.mutesIssued + stats.kicksIssued + stats.bansIssued;

  const embed = {
    color: totalViolations > 10 ? 0xed4245 : totalViolations > 5 ? 0xfee75c : 0x57f287,
    title: `📊 Laporan Harian — ${yesterday}`,
    description: aiSummary.slice(0, 2000) || 'Laporan aktivitas server.',
    fields: [
      {
        name: '👥 Keanggotaan',
        value: [
          `✅ Join: **${stats.membersJoined}**`,
          `❌ Leave: **${stats.membersLeft}**`,
          `${growthEmoji} Net: **${netGrowth > 0 ? '+' : ''}${netGrowth}**`,
        ].join('\n'),
        inline: true,
      },
      {
        name: '💬 Aktivitas',
        value: [
          `📝 Pesan: **${stats.messagesTotal}**`,
          `👤 User aktif: **${stats.activeUsers?.length || 0}**`,
        ].join('\n'),
        inline: true,
      },
      {
        name: '⚖️ Moderasi',
        value: [
          `⚠️ Warning: **${stats.warningsIssued}**`,
          `🔇 Mute: **${stats.mutesIssued}**`,
          `👢 Kick: **${stats.kicksIssued}**`,
          `🔨 Ban: **${stats.bansIssued}**`,
        ].join('\n'),
        inline: true,
      },
      {
        name: '🛡️ Deteksi Otomatis',
        value: [
          `🚨 Spam: **${stats.spamDetected}**`,
          `☠️ Toxic: **${stats.toxicDetected}**`,
          `⚔️ Raid: **${stats.raidAttempts}**`,
        ].join('\n'),
        inline: true,
      },
    ],
    footer: { text: '🤖 Dermist Daily Report • Cron Worker' },
    timestamp: new Date().toISOString(),
  };

  await sendReport(botToken, botChannels.adminChannelId, embed);
  console.log('[JOB] Daily Report — selesai');
}

async function sendReport(botToken, channelId, embed) {
  await fetch(`${DISCORD_API_BASE}/channels/${channelId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ embeds: [embed] }),
  });
}
