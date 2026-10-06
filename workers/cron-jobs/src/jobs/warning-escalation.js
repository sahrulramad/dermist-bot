/**
 * Warning Escalation Job
 * 
 * Setiap 15 menit, cek semua member yang punya warning aktif.
 * Escalation:
 *   3 warn → auto mute 30 menit
 *   5 warn → auto kick
 *   7 warn → auto ban
 * 
 * Warning kadaluarsa setelah 30 hari (configurable).
 */

import { ESCALATION, KV_KEYS, DISCORD_API_BASE } from '../../../../shared/constants.js';

export async function warningEscalation(env) {
  const kv = env.KV;
  console.log('[JOB] Warning Escalation — mulai');

  // Ambil guild ID dari env
  const guildId = env.DISCORD_GUILD_ID;
  const botToken = env.DISCORD_BOT_TOKEN;
  if (!guildId || !botToken) {
    console.warn('[JOB] DISCORD_GUILD_ID atau DISCORD_BOT_TOKEN belum di-set');
    return;
  }

  // List semua warning keys dari KV
  const listResult = await kv.list({ prefix: KV_KEYS.WARNINGS });
  if (!listResult.keys.length) {
    console.log('[JOB] Tidak ada warning data');
    return;
  }

  const now = Date.now();
  const decayMs = ESCALATION.WARN_DECAY_DAYS * 24 * 60 * 60 * 1000;
  let escalated = 0;

  for (const key of listResult.keys) {
    const userId = key.name.replace(KV_KEYS.WARNINGS, '');
    const warnings = await kv.get(key.name, 'json');
    if (!Array.isArray(warnings) || !warnings.length) continue;

    // Hitung active warnings (belum expired dan belum kadaluarsa)
    const activeWarnings = warnings.filter((w) => {
      if (w.expired) return false;
      if (now - w.createdAt > decayMs) return false;
      return true;
    });

    const count = activeWarnings.length;
    if (count < ESCALATION.WARN_TO_MUTE) continue;

    // Cek apakah sudah pernah di-escalate hari ini
    const lastEscKey = `escalation-last:${userId}`;
    const lastEsc = await kv.get(lastEscKey, 'json');
    if (lastEsc && now - lastEsc.timestamp < 60 * 60 * 1000) {
      // Sudah di-escalate dalam 1 jam terakhir, skip
      continue;
    }

    let action = null;
    let actionDetail = '';

    if (count >= ESCALATION.WARN_TO_BAN) {
      action = 'ban';
      actionDetail = `${count} warnings aktif → AUTO BAN`;
      await discordBan(botToken, guildId, userId, `Auto-escalation: ${count} warnings`);
    } else if (count >= ESCALATION.WARN_TO_KICK) {
      action = 'kick';
      actionDetail = `${count} warnings aktif → AUTO KICK`;
      await discordKick(botToken, guildId, userId, `Auto-escalation: ${count} warnings`);
    } else if (count >= ESCALATION.WARN_TO_MUTE) {
      action = 'mute';
      actionDetail = `${count} warnings aktif → AUTO MUTE 30 menit`;
      await discordMute(botToken, guildId, userId, ESCALATION.MUTE_DURATION_MS, `Auto-escalation: ${count} warnings`);
    }

    if (action) {
      escalated++;
      console.log(`[ESCALATION] ${userId}: ${actionDetail}`);
      await kv.put(lastEscKey, JSON.stringify({ timestamp: now, action, count }), { expirationTtl: 3600 });

      // Kirim notifikasi ke admin channel
      await sendEscalationNotification(env, guildId, userId, action, count);
    }
  }

  console.log(`[JOB] Warning Escalation selesai — ${escalated} member di-escalate`);
}

// ─── Discord REST API Helpers ───

async function discordMute(token, guildId, userId, durationMs, reason) {
  const timeout = new Date(Date.now() + durationMs).toISOString();
  await fetch(`${DISCORD_API_BASE}/guilds/${guildId}/members/${userId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json',
      'X-Audit-Log-Reason': reason,
    },
    body: JSON.stringify({ communication_disabled_until: timeout }),
  });
}

async function discordKick(token, guildId, userId, reason) {
  await fetch(`${DISCORD_API_BASE}/guilds/${guildId}/members/${userId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bot ${token}`,
      'X-Audit-Log-Reason': reason,
    },
  });
}

async function discordBan(token, guildId, userId, reason) {
  await fetch(`${DISCORD_API_BASE}/guilds/${guildId}/bans/${userId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json',
      'X-Audit-Log-Reason': reason,
    },
    body: JSON.stringify({ delete_message_seconds: 86400 }),
  });
}

async function sendEscalationNotification(env, guildId, userId, action, warnCount) {
  const kv = env.KV;
  const botToken = env.DISCORD_BOT_TOKEN;

  // Ambil admin channel ID dari bot-channels config
  const botChannels = await kv.get(KV_KEYS.BOT_CHANNELS, 'json');
  if (!botChannels?.adminChannelId) return;

  const actionLabels = { mute: '🔇 MUTE', kick: '👢 KICK', ban: '🔨 BAN' };
  const actionColors = { mute: 0xfee75c, kick: 0xffa500, ban: 0xed4245 };

  const embed = {
    color: actionColors[action] ?? 0xed4245,
    title: `⚡ AUTO-ESCALATION — ${actionLabels[action]}`,
    description: `Warning escalation otomatis dari Cron Worker`,
    fields: [
      { name: '👤 Target', value: `<@${userId}>`, inline: true },
      { name: '⚖️ Aksi', value: actionLabels[action], inline: true },
      { name: '⚠️ Jumlah Warning', value: `${warnCount} warning aktif`, inline: true },
      { name: '📋 Threshold', value: `Mute: ${ESCALATION.WARN_TO_MUTE} | Kick: ${ESCALATION.WARN_TO_KICK} | Ban: ${ESCALATION.WARN_TO_BAN}`, inline: false },
      { name: '🕐 Waktu', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
    ],
    footer: { text: '🤖 Dermist Auto-Escalation System' },
    timestamp: new Date().toISOString(),
  };

  await fetch(`${DISCORD_API_BASE}/channels/${botChannels.adminChannelId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ embeds: [embed] }),
  });
}
