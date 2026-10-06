import { PermissionFlagsBits } from 'discord.js';

// Batas waktu AFK yang wajar: Peringatan di 15 menit, Disconnect di 20 menit
const AFK_THRESHOLD_MS = 15 * 60 * 1000;
const DISCONNECT_MS = 20 * 60 * 1000;
const CHECK_INTERVAL_MS = 60000; // Cek tiap 1 menit

const warnedUsers = new Set();
const afkTrackedTimes = new Map(); // userId -> { channelId, startedAt }

export function resetVoiceAfk(userId) {
  afkTrackedTimes.delete(userId);
  warnedUsers.delete(userId);
}

export function trackVoiceJoin(userId, channelId) {
  resetVoiceAfk(userId);
}

export function trackVoiceLeave(userId) {
  resetVoiceAfk(userId);
}

export function isUserAfk(member, channel, guild) {
  if (!member || !channel) return false;

  // 1. Kebal untuk Bot, Owner Server, dan Administrator
  if (member.user.bot) return false;
  if (member.id === guild.ownerId) return false;
  if (member.permissions?.has?.(PermissionFlagsBits.Administrator)) return false;

  // 2. Jika di channel AFK resmi bawaan server, jangan kick
  if (guild.afkChannelId && channel.id === guild.afkChannelId) return false;

  // 3. Jika sedang streaming layar atau nyalakan kamera, pasti aktif
  if (member.voice.streaming || member.voice.selfVideo) return false;

  // 4. Jika mic terbuka dan headset aktif (tidak mute & tidak deafen), pasti aktif berbicara!
  if (!member.voice.selfMute && !member.voice.selfDeaf) return false;

  const humanCount = Array.from(channel.members?.values?.() || []).filter((m) => !m.user?.bot).length;

  // 5. Dianggap AFK HANYA jika:
  // a) User deafen (tuli: tidak mendengar dan tidak bicara sama sekali)
  // b) User sendirian di channel dan mic-nya di-mute
  const isDeafened = Boolean(member.voice.selfDeaf || member.voice.serverDeaf);
  const isAloneAndMuted = humanCount === 1 && Boolean(member.voice.selfMute || member.voice.serverMute);

  return isDeafened || isAloneAndMuted;
}

export function getVoiceAfkStatus(userId, member, channel, guild) {
  if (!isUserAfk(member, channel, guild)) {
    resetVoiceAfk(userId);
    return null;
  }

  let info = afkTrackedTimes.get(userId);
  if (!info) {
    info = { channelId: channel.id, startedAt: Date.now() };
    afkTrackedTimes.set(userId, info);
    return null;
  }

  const duration = Date.now() - info.startedAt;
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
          const status = getVoiceAfkStatus(userId, member, channel, guild);
          if (!status) continue;

          if (status.shouldDisconnect) {
            try {
              await member.voice.disconnect('AFK (deafen/mute sendirian) lebih dari 20 menit');
              resetVoiceAfk(userId);
              console.log(`[VOICE-AFK] Disconnect ${member.user.tag} (AFK ${Math.round(status.duration / 60000)} menit)`);
            } catch (err) {
              console.log(`[VOICE-AFK] Gagal disconnect ${member.user.tag}: ${err.message}`);
            }
          } else if (status.shouldWarn) {
            try {
              const minutes = Math.round(status.duration / 60000);
              await member.send(
                `⚠️ Kamu terdeteksi tidak aktif (deafen/mute sendirian) di voice channel <#${status.channelId}> di server **${guild.name}** selama ${minutes} menit.\nJika tidak ada aktivitas dalam 5 menit, kamu akan di-disconnect otomatis dari voice channel. Unmute atau bersuaralah jika kamu masih ada! 😊`
              );
              markWarned(userId);
              console.log(`[VOICE-AFK] Warning ${member.user.tag} (AFK ${minutes} menit)`);
            } catch {
              markWarned(userId);
            }
          }
        }
      }
    }
  }, CHECK_INTERVAL_MS);

  console.log('[VOICE-AFK] Checker dimulai (cek tiap 1m: kebal Owner/Admin, aktif jika deafen/mute sendirian >15m)');
}
