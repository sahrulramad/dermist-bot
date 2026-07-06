import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { log } from './logger.js';

function cleanUserId(raw) {
  return raw.replace(/[<@!>]/g, '').trim();
}

function parseDuration(d) {
  const m = d.match(/^(\d+)\s*(s|m|h|d|w)?$/i);
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  const unit = (m[2] || 'm').toLowerCase();
  const mult = { s: 1000, m: 60000, h: 3600000, d: 86400000, w: 604800000 };
  return n * (mult[unit] || 60000);
}

export const tools = [
  {
    type: 'function',
    function: {
      name: 'kick_member',
      description: 'Kick member dari server. Member bisa rejoin dengan invite.',
      parameters: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID atau @mention' },
          reason: { type: 'string', description: 'Alasan kick' },
        },
        required: ['userId'],
      },
    },
    destructive: false,
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
    destructive: true,
  },
  {
    type: 'function',
    function: {
      name: 'mute_member',
      description: 'Timeout/mute member. Cegah kirim pesan untuk durasi tertentu.',
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
    destructive: false,
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
    destructive: false,
  },
  {
    type: 'function',
    function: {
      name: 'warn_member',
      description: 'Beri peringatan ke member. Tercatat di log.',
      parameters: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID atau @mention' },
          reason: { type: 'string', description: 'Alasan warning' },
        },
        required: ['userId', 'reason'],
      },
    },
    destructive: false,
  },
  {
    type: 'function',
    function: {
      name: 'purge_messages',
      description: 'Hapus sejumlah pesan terbaru di channel ini.',
      parameters: {
        type: 'object',
        properties: {
          count: { type: 'number', description: 'Jumlah pesan (1-100)' },
        },
        required: ['count'],
      },
    },
    destructive: false,
  },
  {
    type: 'function',
    function: {
      name: 'create_channel',
      description: 'Buat channel atau kategori baru.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nama channel' },
          type: { type: 'string', enum: ['text', 'voice', 'category'], description: 'Tipe channel' },
        },
        required: ['name'],
      },
    },
    destructive: false,
  },
  {
    type: 'function',
    function: {
      name: 'delete_channel',
      description: 'Hapus channel. DESTRUKTIF — butuh konfirmasi user.',
      parameters: {
        type: 'object',
        properties: {
          channelId: { type: 'string', description: 'Channel ID atau nama' },
        },
        required: ['channelId'],
      },
    },
    destructive: true,
  },
  {
    type: 'function',
    function: {
      name: 'get_member_info',
      description: 'Ambil info member (username, join date, role). Read-only.',
      parameters: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID atau @mention' },
        },
        required: ['userId'],
      },
    },
    destructive: false,
  },
];

export function getToolSchemas() {
  return tools.map((t) => ({ type: 'function', function: t.function }));
}

export function isDestructive(toolName) {
  const t = tools.find((t) => t.function.name === toolName);
  return t?.destructive ?? false;
}

export async function executeTool(toolName, args, ctx) {
  const { guild, channel, message } = ctx;
  const log2 = (msg) => log(`[tool:${toolName}] ${msg}`, 'info');

  switch (toolName) {
    case 'kick_member': {
      const id = cleanUserId(String(args.userId));
      const reason = String(args.reason || 'Kicked by Dermist AI');
      const member = await guild.members.fetch(id).catch(() => null);
      if (!member) return 'Gak nemu member.';
      if (!member.kickable) return 'Bot gak punya izin kick member ini.';
      await member.kick(reason);
      log2(`Kicked ${member.user.tag}: ${reason}`);
      return `Berhasil kick ${member.user.tag}. Alasan: ${reason}`;
    }
    case 'ban_member': {
      const id = cleanUserId(String(args.userId));
      const reason = String(args.reason || 'Banned by Dermist AI');
      const days = Math.min(Number(args.deleteMessageDays) || 0, 7);
      await guild.members.ban(id, { deleteMessageSeconds: days * 86400, reason });
      log2(`Banned ${id}: ${reason}`);
      return `Berhasil ban <@${id}>. Alasan: ${reason}`;
    }
    case 'mute_member': {
      const id = cleanUserId(String(args.userId));
      const dur = parseDuration(String(args.duration || '5m'));
      if (!dur) return `Durasi gak valid: ${args.duration}`;
      const reason = String(args.reason || 'Muted by Dermist AI');
      const member = await guild.members.fetch(id).catch(() => null);
      if (!member) return 'Gak nemu member.';
      if (!member.moderatable) return 'Bot gak punya izin mute member ini.';
      await member.timeout(dur, reason);
      log2(`Muted ${member.user.tag} for ${args.duration}`);
      return `Berhasil mute ${member.user.tag} selama ${args.duration}. Alasan: ${reason}`;
    }
    case 'unmute_member': {
      const id = cleanUserId(String(args.userId));
      const member = await guild.members.fetch(id).catch(() => null);
      if (!member) return 'Gak nemu member.';
      await member.timeout(null);
      log2(`Unmuted ${member.user.tag}`);
      return `Berhasil unmute ${member.user.tag}.`;
    }
    case 'warn_member': {
      const id = cleanUserId(String(args.userId));
      const reason = String(args.reason || 'Warned by Dermist AI');
      const member = await guild.members.fetch(id).catch(() => null);
      if (!member) return 'Gak nemu member.';
      log2(`Warned ${member.user.tag}: ${reason}`);
      try { await member.send(`⚠️ Kamu di-warn di ${guild.name}: ${reason}`); } catch { /* DM closed */ }
      return `Berhasil warn ${member.user.tag}. Alasan: ${reason}`;
    }
    case 'purge_messages': {
      const count = Math.max(1, Math.min(Number(args.count) || 10, 100));
      if (!channel?.bulkDeletable) return 'Channel ini gak bisa di-purge.';
      const deleted = await channel.bulkDelete(count, true);
      log2(`Purged ${deleted.size} messages`);
      return `Berhasil hapus ${deleted.size} pesan.`;
    }
    case 'create_channel': {
      const name = String(args.name);
      const type = String(args.type || 'text');
      const typeMap = { text: ChannelType.GuildText, voice: ChannelType.GuildVoice, category: ChannelType.GuildCategory };
      const ch = await guild.channels.create({ name, type: typeMap[type] || ChannelType.GuildText });
      log2(`Created ${type} channel: ${name}`);
      return `Berhasil buat channel <#${ch.id}>.`;
    }
    case 'delete_channel': {
      let id = String(args.channelId);
      if (!/^\d+$/.test(id)) {
        const ch = guild.channels.cache.find((c) => c.name === id);
        if (!ch) return `Gak nemu channel "${id}".`;
        id = ch.id;
      }
      const ch = guild.channels.cache.get(id);
      if (!ch) return `Gak nemu channel.`;
      const name = ch.name;
      await ch.delete('Deleted by Dermist AI');
      log2(`Deleted channel: ${name}`);
      return `Berhasil hapus channel #${name}.`;
    }
    case 'get_member_info': {
      const id = cleanUserId(String(args.userId));
      const member = await guild.members.fetch(id).catch(() => null);
      if (!member) return 'Gak nemu member.';
      const roles = member.roles.cache.filter((r) => r.id !== guild.id).map((r) => r.name).join(', ') || 'none';
      return `Member: ${member.user.tag}\nID: ${member.id}\nJoin: <t:${Math.floor(member.joinedTimestamp / 1000)}:R>\nRoles: ${roles}`;
    }
    default:
      return `Tool "${toolName}" gak dikenal.`;
  }
}
