import { SlashCommandBuilder, ChannelType, PermissionFlagsBits, EmbedBuilder, MessageFlags } from 'discord.js';
import { errorEmbed } from '../../utils/embeds.js';
import { config } from '../../config.js';
import { log } from '../../utils/logger.js';
import { kvPut } from '../../utils/memory.js';

const P = PermissionFlagsBits;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ════════════════════════════════════════════════════════════
// BLUEPRINT ROLE — urutan array = urutan hierarki (atas → bawah)
// ════════════════════════════════════════════════════════════
const ROLE_BLUEPRINT = [
  { key: 'owner', name: '👑 │ Owner', color: 0xfee75c, hoist: true, permissions: [P.Administrator] },
  { key: 'admin', name: '🛡️ │ Admin', color: 0xed4245, hoist: true, permissions: [P.Administrator] },
  {
    key: 'mod',
    name: '⚔️ │ Moderator',
    color: 0x57f287,
    hoist: true,
    permissions: [P.ManageMessages, P.KickMembers, P.BanMembers, P.ModerateMembers, P.MuteMembers, P.DeafenMembers, P.MoveMembers],
  },
  { key: 'bot', name: '🤖 │ Bot', color: 0x5865f2, hoist: true, permissions: [] },
  { key: 'vip', name: '🌟 │ VIP Member', color: 0xeb459e, hoist: true, permissions: [] },
  { key: 'member', name: '👥 │ Member', color: 0x00d166, hoist: true, permissions: [] },
  { key: 'muted', name: '🔇 │ Muted', color: 0x747f8d, hoist: false, permissions: [] },
];

// ════════════════════════════════════════════════════════════
// BLUEPRINT CHANNEL
// ════════════════════════════════════════════════════════════
const TEXT = ChannelType.GuildText;
const VOICE = ChannelType.GuildVoice;

const CH = {
  // Informasi
  rules: { key: 'rules', name: '📜・rules', type: TEXT, topic: 'Peraturan resmi server. Wajib dibaca dan dipatuhi oleh seluruh member!' },
  announce: { key: 'announce', name: '📢・pengumuman', type: TEXT, topic: 'Informasi dan update terbaru dari admin.' },
  welcome: { key: 'welcome', name: '👋・selamat-datang', type: TEXT, topic: 'Sambut member baru yang baru bergabung!' },
  // Chat umum
  general: { key: 'general', name: '💬・general-chat', type: TEXT, topic: 'Obrolan santai antar sesama member komunitas.' },
  media: { key: 'media', name: '📸・media-share', type: TEXT, topic: 'Bagi-bagi foto, screenshot seru, video, atau meme.' },
  saran: { key: 'saran', name: '💡・saran-masukan', type: TEXT, topic: 'Punya ide atau kritik untuk server? Tulis di sini!' },
  botChat: { key: 'botChat', name: '🤖・bot-chat', type: TEXT, topic: 'Ngobrol dengan @Dermist dan coba command /ask, /memo, /vault!' },
  // Gaming
  mabar: { key: 'mabar', name: '🎮・mabar-chat', type: TEXT, topic: 'Cari teman party mabar Valorant, ML, PUBG, Dota, Minecraft!' },
  clips: { key: 'clips', name: '🔥・clips-highlights', type: TEXT, topic: 'Pamerkan momen clutch dan highlight game kamu!' },
  // Developer
  code: { key: 'code', name: '💻・code-talk', type: TEXT, topic: 'Diskusi web development, backend, frontend, devops, & database.' },
  askTech: { key: 'askTech', name: '❓・tanya-coding', type: TEXT, topic: 'Tanya error coding atau minta review kode ke @Dermist & member.' },
  showcase: { key: 'showcase', name: '🚀・showcase-projek', type: TEXT, topic: 'Pamerkan hasil karyamu, repo GitHub, atau web yang baru dibuat!' },
  // Voice
  vLounge: { key: 'vLounge', name: '🔊・Lounge Santai', type: VOICE },
  vNgobrol1: { key: 'vNgobrol1', name: '🔊・Ngobrol 1', type: VOICE },
  vNgobrol2: { key: 'vNgobrol2', name: '🔊・Ngobrol 2', type: VOICE },
  vDuo: { key: 'vDuo', name: '🎮・Squad Duo [2]', type: VOICE, userLimit: 2 },
  vTrio: { key: 'vTrio', name: '🎮・Squad Trio [3]', type: VOICE, userLimit: 3 },
  vSquad: { key: 'vSquad', name: '🎮・Full Squad [5]', type: VOICE, userLimit: 5 },
  vFocus: { key: 'vFocus', name: '🎧・Focus / Study with Me', type: VOICE },
  vPair: { key: 'vPair', name: '👥・Pair Programming', type: VOICE },
  vAfk: { key: 'vAfk', name: '💤・AFK / Tidur', type: VOICE },
  // Staff
  staffChat: { key: 'staffChat', name: '🛡️・staff-chat', type: TEXT, topic: 'Ruang koordinasi rahasia untuk Admin dan Moderator.' },
  modLogs: { key: 'modLogs', name: '📜・mod-logs', type: TEXT, topic: 'Laporan audit otomatis: auto-moderasi, kick, ban, mute, raid detection.' },
};

const TEMPLATES = {
  community: {
    label: 'Komunitas & Hangout',
    info: [CH.rules, CH.announce, CH.welcome],
    chat: [CH.general, CH.media, CH.saran, CH.botChat],
    voice: [CH.vLounge, CH.vNgobrol1, CH.vNgobrol2, CH.vAfk],
  },
  gaming: {
    label: 'Gaming & Mabar',
    info: [CH.rules, CH.announce, CH.welcome],
    chat: [CH.general, CH.media, CH.mabar, CH.clips, CH.botChat],
    voice: [CH.vLounge, CH.vDuo, CH.vTrio, CH.vSquad, CH.vAfk],
  },
  developer: {
    label: 'Developer & Tech',
    info: [CH.rules, CH.announce, CH.welcome],
    chat: [CH.general, CH.code, CH.askTech, CH.showcase, CH.botChat],
    voice: [CH.vLounge, CH.vFocus, CH.vPair, CH.vAfk],
  },
  minimalist: {
    label: 'Minimalist',
    info: [CH.rules, CH.welcome],
    chat: [CH.general, CH.botChat],
    voice: [CH.vLounge, CH.vAfk],
  },
};
const STAFF_CHANNELS = [CH.staffChat, CH.modLogs];

const CATEGORY_NAMES = {
  info: '📌 ︱INFORMASI',
  chat: '💬 ︱KOMUNITAS & CHAT',
  voice: '🔊 ︱VOICE ROOMS',
  staff: '🔒 ︱STAFF AREA',
};

// ════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════

// Discord menormalisasi nama text channel (lowercase, spasi → "-"), jadi bandingkan versi normal
const norm = (s) => s.toLowerCase().trim().replace(/\s+/g, '-');

async function ensureRole(guild, def, stats) {
  const existing = guild.roles.cache.find((r) => norm(r.name) === norm(def.name));
  if (existing) {
    stats.rolesReused++;
    return existing;
  }
  const role = await guild.roles.create({
    name: def.name,
    color: def.color,
    hoist: def.hoist,
    permissions: def.permissions,
    reason: 'Dermist /setup-server',
  });
  stats.rolesCreated++;
  await sleep(300);
  return role;
}

/**
 * Susun ulang posisi role secara eksplisit (atas → bawah) tepat di bawah role tertinggi bot.
 * Tidak mengandalkan posisi default Discord saat role dibuat.
 * Return: role yang tidak bisa dipindah karena posisinya >= role tertinggi bot.
 */
async function arrangeRoles(guild, orderedRoles) {
  await guild.roles.fetch();
  const me = guild.members.me ?? (await guild.members.fetchMe());
  const botTop = me.roles.highest.position;

  const fresh = orderedRoles.map((r) => guild.roles.cache.get(r.id) ?? r);
  const movable = fresh.filter((r) => r.position < botTop);
  const blocked = fresh.filter((r) => r.position >= botTop);

  if (movable.length) {
    await guild.roles.setPositions(
      movable.map((r, i) => ({ role: r.id, position: Math.max(1, botTop - 1 - i) })),
    );
  }

  // Verifikasi hasil akhir
  await guild.roles.fetch();
  const finalPositions = movable.map((r) => guild.roles.cache.get(r.id)?.position ?? 0);
  const ordered = finalPositions.every((pos, i) => i === 0 || finalPositions[i - 1] > pos);

  return { blocked, ordered };
}

async function ensureCategory(guild, name, overwrites, stats) {
  let cat = guild.channels.cache.find((c) => c.type === ChannelType.GuildCategory && norm(c.name) === norm(name));
  if (cat) {
    await cat.permissionOverwrites.set(overwrites);
    stats.channelsReused++;
  } else {
    cat = await guild.channels.create({ name, type: ChannelType.GuildCategory, permissionOverwrites: overwrites });
    stats.channelsCreated++;
    await sleep(300);
  }
  return cat;
}

async function ensureChannel(guild, def, parent, stats) {
  let ch = guild.channels.cache.find((c) => c.type === def.type && c.parentId === parent.id && norm(c.name) === norm(def.name));
  let isNew = false;

  if (!ch) {
    const payload = { name: def.name, type: def.type, parent: parent.id };
    if (def.type === TEXT && def.topic) payload.topic = def.topic;
    if (def.type === VOICE && def.userLimit) payload.userLimit = def.userLimit;
    ch = await guild.channels.create(payload);
    isNew = true;
    stats.channelsCreated++;
    await sleep(300);
  } else {
    stats.channelsReused++;
  }

  // Sinkronkan permission dengan kategori secara eksplisit (staff channel WAJIB ikut terkunci)
  await ch.lockPermissions();
  return { ch, isNew };
}

function buildOverwrites(guild, roles) {
  const botId = guild.client.user.id;
  const botAccess = { id: botId, allow: [P.ViewChannel, P.SendMessages, P.EmbedLinks, P.ReadMessageHistory] };

  return {
    info: [
      { id: guild.id, allow: [P.ViewChannel, P.ReadMessageHistory], deny: [P.SendMessages, P.AddReactions] },
      { id: roles.admin.id, allow: [P.SendMessages, P.ManageMessages] },
      { id: roles.mod.id, allow: [P.SendMessages] },
      botAccess,
    ],
    chat: [
      { id: guild.id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.AttachFiles] },
      { id: roles.muted.id, deny: [P.SendMessages, P.SendMessagesInThreads, P.CreatePublicThreads, P.AddReactions] },
      botAccess,
    ],
    voice: [
      { id: guild.id, allow: [P.ViewChannel, P.Connect, P.Speak] },
      { id: roles.muted.id, deny: [P.Speak] },
    ],
    staff: [
      { id: guild.id, deny: [P.ViewChannel] },
      { id: roles.admin.id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory] },
      { id: roles.mod.id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory] },
      botAccess,
    ],
  };
}

// ════════════════════════════════════════════════════════════
// EMBEDS
// ════════════════════════════════════════════════════════════
function rulesEmbeds(guild, botChatId) {
  const header = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`📜 PERATURAN RESMI KOMUNITAS — ${guild.name.toUpperCase()}`)
    .setDescription(
      `Selamat datang di **${guild.name}**!\nHarap membaca dan mematuhi peraturan di bawah ini demi kenyamanan bersama. Bergabung di server ini berarti kamu menyetujui semua aturan yang berlaku.`,
    )
    .setThumbnail(guild.iconURL({ size: 256 }));

  const content = new EmbedBuilder()
    .setColor(0x5865f2)
    .addFields(
      {
        name: '1️⃣ SIKAP & ETIKA BERKOMUNIKASI',
        value:
          '• Saling menghormati antar sesama member dan staf moderator.\n• Dilarang keras pelecehan, ujaran kebencian, SARA, dan toxic.\n• Perdebatan sehat boleh, tapi dilarang menyerang pribadi (ad hominem).',
      },
      {
        name: '2️⃣ ANTI-SPAM & KEAMANAN',
        value:
          '• Dilarang spam pesan bertubi-tubi (> 5 pesan dalam 10 detik).\n• **Cross-Channel Photo Spam**: dilarang menyebar gambar yang sama di banyak channel sekaligus.\n• Dilarang menyebar link phising, scam, invite server lain, atau konten NSFW.',
      },
      {
        name: '3️⃣ SISTEM SANKSI BERTINGKAT',
        value:
          '• **1x**: Teguran resmi / Warning\n• **2x**: Timeout 1 jam\n• **3x**: Timeout 24 jam\n• **4x**: Kick atau Permanent Ban\n_Warning kadaluarsa otomatis setelah 30 hari._',
      },
      {
        name: '4️⃣ PENGGUNAAN ASISTEN AI (DERMIST)',
        value: `• Mention \`@Dermist\` di <#${botChatId}> atau pakai \`/ask\` untuk bertanya.\n• Dilarang mencoba prompt injection atau memaksa bot membocorkan rahasia sistem.`,
      },
    )
    .setFooter({ text: 'Dermist Auto-Moderation System • Patuhi aturan dan nikmati komunitas kami!' })
    .setTimestamp();

  return [header, content];
}

function welcomeGuideEmbed(guild, ids) {
  return new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle(`🎉 Selamat Datang di ${guild.name}!`)
    .setDescription(
      `Senang sekali kamu bergabung bersama kami.\n\n**Langkah awal:**\n` +
        `1. 📜 Baca peraturan di <#${ids.rules}>\n` +
        `2. 💬 Sapa yang lain di <#${ids.general}>\n` +
        `3. 🤖 Ngobrol dengan bot AI di <#${ids.botChat}>\n\nSemoga betah! ✨`,
    )
    .setTimestamp();
}

function botGuideEmbed(guild) {
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('🤖 Pusat Interaksi AI — Dermist')
    .setDescription('Halo! Aku **Dermist**, asisten AI di server ini. Ngobrol santai atau pakai command berikut:')
    .addFields(
      {
        name: '💬 Tanya Jawab',
        value: `\`/ask <pertanyaan>\` — Tanya apa saja\n\`/translate\` — Terjemahkan teks\nAtau **mention** <@${guild.client.user.id}> langsung di sini!`,
      },
      {
        name: '🧠 Memory',
        value: '`/memo add` — Simpan preferensi kamu\n`/memo list` — Lihat memo\n`/memo search` — Cari memo\n`/facts` — Lihat yang aku ingat tentangmu',
      },
      { name: '📚 Knowledge Base', value: '`/vault search <topik>` — Cari catatan & aturan server\n`/vault status` — Status sinkronisasi' },
    )
    .setFooter({ text: 'Dermist AI • Always learning & assisting you' });
}

function modLogHeaderEmbed() {
  return new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle('🛡️ Pusat Log Moderasi & Audit Server')
    .setDescription(
      '• Auto-detect spam & cross-channel photo spam\n• Filter toxic & ujaran kebencian\n• Eksekusi kick, ban, mute, warn\n• Anti-raid lockdown logs',
    )
    .setTimestamp();
}

// ════════════════════════════════════════════════════════════
// COMMAND
// ════════════════════════════════════════════════════════════
export default {
  data: new SlashCommandBuilder()
    .setName('setup-server')
    .setDescription('Setup otomatis server (role, kategori, channel & rules) — aman dijalankan ulang')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((opt) =>
      opt
        .setName('template')
        .setDescription('Pilih tema template server')
        .setRequired(true)
        .addChoices(
          { name: '🌐 Komunitas & Hangout', value: 'community' },
          { name: '🎮 Gaming & Mabar', value: 'gaming' },
          { name: '💻 Developer & Tech', value: 'developer' },
          { name: '✨ Minimalist', value: 'minimalist' },
        ),
    )
    .addBooleanOption((opt) => opt.setName('post_rules').setDescription('Kirim embed peraturan ke #rules (hanya jika channel baru dibuat). Default: Ya'))
    .addBooleanOption((opt) => opt.setName('post_guides').setDescription('Kirim embed panduan ke channel baru. Default: Ya')),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const guild = interaction.guild;
    const templateKey = interaction.options.getString('template');
    const template = TEMPLATES[templateKey];
    const shouldPostRules = interaction.options.getBoolean('post_rules') ?? true;
    const shouldPostGuides = interaction.options.getBoolean('post_guides') ?? true;

    if (!template) {
      return interaction.editReply({ embeds: [errorEmbed('Template Tidak Dikenal', `Template \`${templateKey}\` tidak tersedia.`)] });
    }

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(config.embedColor)
          .setTitle('⚙️ Menyusun server...')
          .setDescription(`Template: **${template.label}**\nDermist sedang menyiapkan role, kategori, dan channel.`),
      ],
    });

    const stats = { rolesCreated: 0, rolesReused: 0, channelsCreated: 0, channelsReused: 0 };

    try {
      // ── 1. ROLES ──
      log(`[Setup-Server] Mulai di ${guild.name} (template: ${templateKey})`, 'info');
      const roles = {};
      for (const def of ROLE_BLUEPRINT) {
        roles[def.key] = await ensureRole(guild, def, stats);
      }
      const { blocked, ordered } = await arrangeRoles(guild, ROLE_BLUEPRINT.map((d) => roles[d.key]));

      // ── 2. KATEGORI & CHANNEL ──
      const overwrites = buildOverwrites(guild, roles);
      const channels = {}; // key → { ch, isNew }

      const sections = [
        ['info', template.info],
        ['chat', template.chat],
        ['voice', template.voice],
        ['staff', STAFF_CHANNELS],
      ];

      for (const [section, defs] of sections) {
        const category = await ensureCategory(guild, CATEGORY_NAMES[section], overwrites[section], stats);
        for (const def of defs) {
          channels[def.key] = await ensureChannel(guild, def, category, stats);
        }
      }

      const id = (key) => channels[key]?.ch.id;

      // ── 3. EMBEDS (hanya ke channel yang BARU dibuat → tidak dobel saat dijalankan ulang) ──
      if (shouldPostRules && channels.rules?.isNew) {
        await channels.rules.ch.send({ embeds: rulesEmbeds(guild, id('botChat')) });
      }
      if (shouldPostGuides && channels.welcome?.isNew) {
        await channels.welcome.ch.send({ embeds: [welcomeGuideEmbed(guild, { rules: id('rules'), general: id('general'), botChat: id('botChat') })] });
      }
      if (shouldPostGuides && channels.botChat?.isNew) {
        await channels.botChat.ch.send({ embeds: [botGuideEmbed(guild)] });
      }
      if (channels.modLogs?.isNew) {
        await channels.modLogs.ch.send({ embeds: [modLogHeaderEmbed()] });
      }

      // ── 4. SIMPAN KE KV ──
      await kvPut('bot-channels', {
        adminChannelId: id('modLogs'),
        publicChannelId: id('botChat'),
        welcomeChannelId: id('welcome'),
        rulesChannelId: id('rules'),
        guildId: guild.id,
        autoRoleId: roles.member.id,
      });
      await kvPut(`server-config:${guild.id}`, {
        welcomeChannelId: id('welcome'),
        logChannelId: id('modLogs'),
        rulesChannelId: id('rules'),
        autoRoleId: roles.member.id,
        modRoleId: roles.mod.id,
        adminRoleId: roles.admin.id,
        mutedRoleId: roles.muted.id,
        templateUsed: templateKey,
        setupAt: Date.now(),
      });

      log(`[Setup-Server] Selesai: ${JSON.stringify(stats)}, roleOrdered=${ordered}, blocked=${blocked.length}`, 'success');

      // ── 5. LAPORAN ──
      const roleStatus = blocked.length
        ? `⚠️ ${blocked.length} role ada di atas role bot, jadi tidak bisa dipindah: ${blocked.map((r) => r.name).join(', ')}.\nGeser role **Dermist** ke paling atas di Server Settings → Roles, lalu jalankan ulang command ini.`
        : ordered
          ? '✅ Urutan sudah benar: Owner → Admin → Moderator → Bot → VIP → Member → Muted'
          : '⚠️ Urutan role belum sesuai. Cek manual di Server Settings → Roles.';

      const finish = new EmbedBuilder()
        .setColor(blocked.length || !ordered ? 0xfee75c : 0x57f287)
        .setTitle('🎉 Setup Server Selesai')
        .setDescription(`Template **${template.label}** diterapkan di **${guild.name}**.`)
        .addFields(
          { name: '👑 Role', value: `${stats.rolesCreated} dibuat, ${stats.rolesReused} sudah ada`, inline: true },
          { name: '📁 Channel & Kategori', value: `${stats.channelsCreated} dibuat, ${stats.channelsReused} sudah ada`, inline: true },
          { name: '📊 Hierarki Role', value: roleStatus, inline: false },
          { name: '📜 Rules', value: `<#${id('rules')}>`, inline: true },
          { name: '💬 Chat', value: `<#${id('general')}>`, inline: true },
          { name: '🤖 Bot Hub', value: `<#${id('botChat')}>`, inline: true },
        )
        .setFooter({ text: 'Aman dijalankan ulang: channel/role yang sudah ada dipakai lagi, tidak diduplikasi.' })
        .setTimestamp();

      return interaction.editReply({ embeds: [finish] });
    } catch (err) {
      log(`[Setup-Server Error] ${err.message}`, 'error');
      return interaction.editReply({
        embeds: [
          errorEmbed(
            'Setup Gagal',
            `\`${err.message}\`\n\n**Pastikan:**\n1. Role bot Dermist ada di urutan paling atas (Server Settings → Roles).\n2. Bot punya permission **Administrator** (wajib untuk membuat role Owner/Admin).\n\n_Progres yang sudah jadi tidak hilang. Jalankan ulang command ini dan bagian yang belum jadi akan dilanjutkan._`,
          ),
        ],
      });
    }
  },
};
