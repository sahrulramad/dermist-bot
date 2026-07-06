import { EmbedBuilder } from 'discord.js';
import { config } from '../config.js';
import { log } from './logger.js';

const KV_BASE = `https://api.cloudflare.com/client/v4/accounts/${config.cfAccountId}/storage/kv/namespaces/${config.cfKvNamespaceId}/values`;
const KV_HEADERS = { Authorization: `Bearer ${config.cfKvToken || config.cfApiToken}` };

async function getBotChannels() {
  try {
    const res = await fetch(`${KV_BASE}/${encodeURIComponent('bot-channels')}`, { headers: KV_HEADERS });
    if (!res.ok) return null;
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

async function sendToChannel(guild, channelId, content) {
  if (!channelId) return;
  const channel = guild.channels.cache.get(channelId);
  if (!channel) return;
  try {
    await channel.send(content);
  } catch (err) {
    log(`Notifier error: ${err.message}`, 'error');
  }
}

export async function notifyAdmin(guild, embedData) {
  const channels = await getBotChannels();
  if (!channels?.adminChannelId) return;
  const embed = new EmbedBuilder()
    .setColor(embedData.color ?? 0xed4245)
    .setTitle(embedData.title ?? '📋 Laporan Admin')
    .setDescription(embedData.description ?? '')
    .setTimestamp();
  if (embedData.fields) embed.addFields(embedData.fields);
  if (embedData.footer) embed.setFooter({ text: embedData.footer });
  await sendToChannel(guild, channels.adminChannelId, { embeds: [embed] });
}

export async function notifyPublic(guild, embedData) {
  const channels = await getBotChannels();
  if (!channels?.publicChannelId) return;
  const embed = new EmbedBuilder()
    .setColor(embedData.color ?? 0x5865f2)
    .setTitle(embedData.title ?? 'ℹ️ Info Server')
    .setDescription(embedData.description ?? '')
    .setTimestamp();
  if (embedData.fields) embed.addFields(embedData.fields);
  await sendToChannel(guild, channels.publicChannelId, { embeds: [embed] });
}

export async function notifyModerationAction(guild, action, details) {
  const { toolName, target, reason, result, auto = false } = details;

  const actionLabels = {
    kick_member: 'KICK',
    ban_member: 'BAN',
    mute_member: 'MUTE',
    unmute_member: 'UNMUTE',
    warn_member: 'WARN',
    purge_messages: 'PURGE',
    create_channel: 'CREATE CHANNEL',
    delete_channel: 'DELETE CHANNEL',
  };

  const label = actionLabels[toolName] ?? toolName.toUpperCase();
  const colors = {
    kick_member: 0xfee75c,
    ban_member: 0xed4245,
    mute_member: 0xfee75c,
    warn_member: 0xfee75c,
    purge_messages: 0xfee75c,
    create_channel: 0x57f287,
    delete_channel: 0xed4245,
  };

  const autoTag = auto ? '🤖 AUTO' : '👤 MANUAL';
  const severity = ['ban_member', 'delete_channel'].includes(toolName) ? 'BERAT' : ['kick_member', 'mute_member', 'warn_member', 'purge_messages'].includes(toolName) ? 'SEDANG' : 'RINGAN';

  await notifyAdmin(guild, {
    title: `🚨 [ADMIN] ${label} — ${severity}`,
    description: `${autoTag} | Aksi moderasi dieksekusi`,
    color: colors[toolName] ?? 0xed4245,
    fields: [
      { name: '🎯 Target', value: target ?? 'N/A', inline: true },
      { name: '⚖️ Aksi', value: label, inline: true },
      { name: '📊 Severity', value: severity, inline: true },
      { name: '📝 Alasan', value: reason ?? 'Tidak ada alasan', inline: false },
      { name: '✅ Hasil', value: (result ?? 'Berhasil').slice(0, 500), inline: false },
      { name: '🕐 Waktu', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
    ],
    footer: `Dermist Moderation System • ${autoTag}`,
  });

  const publicActions = ['mute_member', 'kick_member', 'ban_member', 'warn_member'];
  if (publicActions.includes(toolName)) {
    const publicMsgs = {
      mute_member: `telun di-mute sementara`,
      kick_member: `telun di-kick`,
      ban_member: `telun di-ban`,
      warn_member: `telun diberi peringatan`,
    };
    await notifyPublic(guild, {
      title: '⚖️ Tindakan Moderasi',
      description: `Member ${target} ${publicMsgs[toolName]}.\n**Alasan:** ${reason ?? 'Pelanggaran aturan'}\n\nTetap jaga suasana server ya! 🙏`,
      color: colors[toolName] ?? 0xfee75c,
      fields: [
        { name: '⚖️ Aksi', value: label, inline: true },
        { name: '🕐 Waktu', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
      ],
    });
  }
}

export async function notifyAutoDetect(guild, type, userName, detail) {
  const typeLabels = {
    spam: '🚨 SPAM DETECTED',
    toxic: '⚠️ TOXIC DETECTED',
    slur: '🚫 HATE SPEECH DETECTED',
  };

  await notifyAdmin(guild, {
    title: `${typeLabels[type] ?? '⚠️ ALERT'} [ADMIN]`,
    description: `Auto-detection system menangkap pelanggaran`,
    color: 0xed4245,
    fields: [
      { name: '👤 User', value: userName, inline: true },
      { name: '🔍 Tipe', value: type.toUpperCase(), inline: true },
      { name: '📝 Detail', value: detail.slice(0, 500), inline: false },
      { name: '🕐 Waktu', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
    ],
    footer: 'Dermist Auto-Detection System',
  });
}
