const AFK_THRESHOLD_MS = 3 * 60 * 1000;
const DISCONNECT_MS = 4 * 60 * 1000;
const CHECK_INTERVAL_MS = 30000;
const warnedUsers = new Set();
const voiceJoinTimes = new Map();

export function trackVoiceJoin(userId, channelId) {
  voiceJoinTimes.set(userId, { channelId, joinedAt: Date.now() });
}

export function trackVoiceLeave(userId) {
  voiceJoinTimes.delete(userId);
  warnedUsers.delete(userId);
}

export function getVoiceAfkStatus(userId) {
  const info = voiceJoinTimes.get(userId);
  if (!info) return null;
  const duration = Date.now() - info.joinedAt;
  return {
    userId,
    channelId: info.channelId,
    duration,
    shouldWarn: duration >= AFK_THRESHOLD_MS && duration < DISCONNECT_MS && !warnedUsers.has(userId),
    shouldDisconnect: duration >= DISCONNECT_MS,
  };
}

export function markWarned(userId) {
  warnedUsers.add(userId);
}

export function startVoiceAfkChecker(client) {
  setInterval(async () => {
    for (const guild of client.guilds.cache.values()) {
      for (const [channelId, channel] of guild.channels.cache) {
        if (!channel.isVoiceBased?.()) continue;
        for (const [userId, member] of channel.members) {
          if (member.user.bot) continue;
          const status = getVoiceAfkStatus(userId);
          if (!status) continue;

          if (status.shouldDisconnect) {
            try {
              await member.voice.disconnect('AFK di voice channel lebih dari 4 menit');
              trackVoiceLeave(userId);
              console.log(`[VOICE-AFK] Disconnect ${member.user.tag} (AFK ${Math.round(status.duration / 1000)}s)`);
            } catch (err) {
              console.log(`[VOICE-AFK] Gagal disconnect ${member.user.tag}: ${err.message}`);
            }
          } else if (status.shouldWarn) {
            try {
              await member.send(`⚠️ Kamu sudah diam di voice channel <#${status.channelId}> selama ${Math.round(status.duration / 1000)} detik.\nKalau tidak aktif, kamu akan di-disconnect dalam 1 menit. Keluar voice channel kalo masih ada! 😊`);
              markWarned(userId);
              console.log(`[VOICE-AFK] Warning ${member.user.tag}`);
            } catch {
              markWarned(userId);
            }
          }
        }
      }
    }
  }, CHECK_INTERVAL_MS);

  console.log('[VOICE-AFK] Checker dimulai (cek tiap 30s, warn di 3menit, disconnect di 4menit)');
}
