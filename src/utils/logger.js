import { config } from '../config.js';

const COLORS = {
  success: 0x57f287,
  error: 0xed4245,
  warning: 0xfee75c,
  info: 0x5865f2,
  log: 0x2b2d31,
};

export function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const color = COLORS[level] ?? COLORS.info;
  console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
  return color;
}

export function buildLogEmbed({ title, description, fields = [], color = COLORS.log, user = null }) {
  return {
    color,
    title,
    description,
    fields: fields.filter(Boolean),
    timestamp: new Date().toISOString(),
    footer: user ? { text: `User: ${user.tag} (${user.id})` } : undefined,
  };
}

export async function sendLog(guild, embedData) {
  if (!config.logChannelId) return;
  const channel = guild.channels.cache.get(config.logChannelId);
  if (!channel) return;
  try {
    await channel.send({ embeds: [buildLogEmbed(embedData)] });
  } catch (err) {
    log(`Gagal kirim log: ${err.message}`, 'error');
  }
}
