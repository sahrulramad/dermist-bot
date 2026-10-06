import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { log } from './logger.js';

function cleanUserId(raw) {
  return String(raw || '').replace(/[<@!>]/g, '').trim();
}

export async function resolveMember(guild, rawInput, ctx) {
  if (!guild) return null;

  const raw = String(rawInput ?? '').trim();
  const selfPronouns = ['me', 'gua', 'gw', 'aku', 'saya', 'self', 'author', 'sender', 'diriku', 'gue', 'mine', 'saya sendiri'];

  // 1. If empty or self-pronoun, return author's member
  if (!raw || selfPronouns.includes(raw.toLowerCase())) {
    if (ctx?.message?.member) return ctx.message.member;
    if (ctx?.message?.author?.id) {
      const m = await guild.members.fetch(ctx.message.author.id).catch(() => null);
      if (m) return m;
    }
  }

  // 2. Check if it's a mention or snowflake ID (17-20 digits)
  const idMatch = raw.replace(/[<@!>]/g, '').trim();
  if (/^\d{17,20}$/.test(idMatch)) {
    const member = await guild.members.fetch(idMatch).catch(() => null);
    if (member) return member;
  }

  const qLower = raw.toLowerCase();

  // 3. Quick check against message author (matching username, tag, displayName, or nickname)
  if (ctx?.message?.member) {
    const m = ctx.message.member;
    if (
      m.user.username.toLowerCase() === qLower ||
      m.user.tag.toLowerCase() === qLower ||
      m.displayName.toLowerCase() === qLower ||
      (m.nickname && m.nickname.toLowerCase() === qLower)
    ) {
      return m;
    }
  }

  // 4. Exact match in guild members cache
  let found = guild.members.cache.find((m) =>
    m.user.username.toLowerCase() === qLower ||
    m.user.tag.toLowerCase() === qLower ||
    m.displayName.toLowerCase() === qLower ||
    (m.nickname && m.nickname.toLowerCase() === qLower)
  );
  if (found) return found;

  // 5. Discord API query fetch (server-side member search)
  try {
    const fetched = await guild.members.fetch({ query: raw, limit: 1 });
    if (fetched && fetched.size > 0) {
      return fetched.first();
    }
  } catch {
    // Ignore fetch query error
  }

  // 6. Substring match in guild cache
  found = guild.members.cache.find((m) =>
    m.user.username.toLowerCase().includes(qLower) ||
    m.displayName.toLowerCase().includes(qLower) ||
    (m.nickname && m.nickname.toLowerCase().includes(qLower))
  );
  if (found) return found;

  return null;
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
          userId: { type: 'string', description: 'User ID, @mention, atau nama member' },
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
          userId: { type: 'string', description: 'User ID, @mention, atau nama member' },
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
          userId: { type: 'string', description: 'User ID, @mention, atau nama member' },
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
          userId: { type: 'string', description: 'User ID, @mention, atau nama member' },
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
          userId: { type: 'string', description: 'User ID, @mention, atau nama member' },
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
      description: 'Ambil info lengkap satu member Discord (username, display name, roles, join date, status owner/admin). Masukkan ID, @mention, username, nickname, atau kosongkan / isi "me"/"gua" untuk info user yang sedang berbicara.',
      parameters: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID, @mention, username/nickname, atau "me"/"gua" untuk info diri sendiri' },
        },
      },
    },
    destructive: false,
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

export function isModerationTool(toolName) {
  return [
    'kick_member',
    'ban_member',
    'mute_member',
    'unmute_member',
    'warn_member',
    'purge_messages',
    'create_channel',
    'delete_channel',
  ].includes(toolName);
}

export function isInformationalTool(toolName) {
  return ['get_member_info', 'get_server_members'].includes(toolName);
}

export async function executeTool(toolName, args, ctx) {
  const { guild, channel, message } = ctx;
  const log2 = (msg) => log(`[tool:${toolName}] ${msg}`, 'info');

  switch (toolName) {
    case 'kick_member': {
      const member = await resolveMember(guild, args.userId, ctx);
      if (!member) return `Gak nemu member "${args.userId || 'yang dimaksud'}".`;
      const reason = String(args.reason || 'Kicked by Dermist AI');
      if (!member.kickable) return `Bot gak punya izin kick member ${member.user.tag}.`;
      await member.kick(reason);
      log2(`Kicked ${member.user.tag}: ${reason}`);
      return `Berhasil kick ${member.user.tag}. Alasan: ${reason}`;
    }
    case 'ban_member': {
      let targetId = null;
      let targetTag = args.userId;
      const member = await resolveMember(guild, args.userId, ctx);
      if (member) {
        targetId = member.id;
        targetTag = member.user.tag;
      } else {
        const idMatch = String(args.userId || '').replace(/\D/g, '');
        if (/^\d{17,20}$/.test(idMatch)) {
          targetId = idMatch;
          targetTag = `<@${targetId}>`;
        }
      }
      if (!targetId) return `Gak nemu member "${args.userId}".`;
      const reason = String(args.reason || 'Banned by Dermist AI');
      const days = Math.min(Number(args.deleteMessageDays) || 0, 7);
      await guild.members.ban(targetId, { deleteMessageSeconds: days * 86400, reason });
      log2(`Banned ${targetTag}: ${reason}`);
      return `Berhasil ban ${targetTag}. Alasan: ${reason}`;
    }
    case 'mute_member': {
      const member = await resolveMember(guild, args.userId, ctx);
      if (!member) return `Gak nemu member "${args.userId || 'yang dimaksud'}".`;
      const dur = parseDuration(String(args.duration || '5m'));
      if (!dur) return `Durasi gak valid: ${args.duration}`;
      const reason = String(args.reason || 'Muted by Dermist AI');
      if (!member.moderatable) return `Bot gak punya izin mute member ${member.user.tag}.`;
      await member.timeout(dur, reason);
      log2(`Muted ${member.user.tag} for ${args.duration}`);
      return `Berhasil mute ${member.user.tag} selama ${args.duration}. Alasan: ${reason}`;
    }
    case 'unmute_member': {
      const member = await resolveMember(guild, args.userId, ctx);
      if (!member) return `Gak nemu member "${args.userId || 'yang dimaksud'}".`;
      await member.timeout(null);
      log2(`Unmuted ${member.user.tag}`);
      return `Berhasil unmute ${member.user.tag}.`;
    }
    case 'warn_member': {
      const member = await resolveMember(guild, args.userId, ctx);
      if (!member) return `Gak nemu member "${args.userId || 'yang dimaksud'}".`;
      const reason = String(args.reason || 'Warned by Dermist AI');
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
      const member = await resolveMember(guild, args.userId, ctx);
      if (!member) return `Gak nemu member "${args.userId || 'kamu'}".`;
      const roleList = member.roles?.cache ? Array.from(member.roles.cache.values()) : [];
      const roles = roleList
        .filter((r) => r.id !== guild.id)
        .map((r) => r.name)
        .join(', ') || 'tidak ada role';
      const isOwner = member.id === guild.ownerId;
      const isAdmin = Boolean(member.permissions?.has?.(PermissionFlagsBits.Administrator));
      const joined = member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : 'Unknown';
      const dispName = member.displayName || member.user.username;
      const nickStr = member.nickname ? ` (Nickname Server: ${member.nickname})` : '';
      const statusTitle = isOwner ? '👑 Owner Server' : isAdmin ? '🛡️ Admin' : 'Member';
      return `Nama Tampilan / Display: ${dispName}${nickStr}\nUsername Discord: @${member.user.username}\nID: ${member.id}\nStatus: ${statusTitle}\nRoles: ${roles}\nBergabung: ${joined}`;
    }
    case 'get_server_members': {
      await guild.members.fetch().catch(() => null);
      const allMembers = Array.from(guild.members.cache.values());
      const filter = String(args.filter || 'all').toLowerCase();

      let targetMembers = allMembers;
      if (filter === 'humans') targetMembers = allMembers.filter((m) => !m.user.bot);
      if (filter === 'bots') targetMembers = allMembers.filter((m) => m.user.bot);

      const humanLines = allMembers
        .filter((m) => !m.user.bot)
        .map((m) => {
          const isOwner = m.id === guild.ownerId ? ' [👑 Owner Server]' : '';
          const roleList = (m.roles?.cache ? Array.from(m.roles.cache.values()) : [])
            .filter((r) => r.id !== guild.id)
            .map((r) => r.name)
            .join(', ') || 'tidak ada role';
          const status = m.presence?.status || 'offline';
          const dispName = m.displayName || m.user.username;
          return `- **${dispName}** (@${m.user.username})${isOwner} [status: ${status}] — Roles: ${roleList}`;
        });

      const botLines = allMembers
        .filter((m) => m.user.bot)
        .map((m) => `- **${m.displayName || m.user.username}** (@${m.user.username}) [Bot]`);

      const totalHumans = allMembers.filter((m) => !m.user.bot).length;
      const totalBots = allMembers.filter((m) => m.user.bot).length;

      return `Total Member Server: ${allMembers.length} (${totalHumans} member manusia, ${totalBots} bot)
Member Manusia:
${humanLines.join('\n') || '- (kosong)'}
Bot:
${botLines.join('\n') || '- (kosong)'}`;
    }
    default:
      return `Tool "${toolName}" gak dikenal.`;
  }
}
