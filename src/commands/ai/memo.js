import { SlashCommandBuilder, EmbedBuilder, MessageFlags, PermissionFlagsBits } from 'discord.js';
import {
  addMemo,
  getMemos,
  removeMemo,
  clearMemos,
  getServerMemos,
  addServerMemo,
  removeServerMemo,
} from '../../utils/memory.js';
import { config } from '../../config.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';
import { embed, cosine } from '../../utils/embeddings.js';

export default {
  data: new SlashCommandBuilder()
    .setName('memo')
    .setDescription('Kelola ingatan & catatan personal atau server untuk AI Dermist')
    // ── Subcommand: add ──
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Simpan memo personal baru untuk kamu')
        .addStringOption((opt) =>
          opt.setName('teks').setDescription('Isi catatan/preferensi yang ingin diingat').setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('kategori')
            .setDescription('Kategori catatan')
            .addChoices(
              { name: 'Preferensi', value: 'preferensi' },
              { name: 'Pekerjaan / Studi', value: 'pekerjaan' },
              { name: 'Hobi / Minat', value: 'hobi' },
              { name: 'Projek', value: 'projek' },
              { name: 'Umum / Lainnya', value: 'general' }
            )
        )
    )
    // ── Subcommand: list ──
    .addSubcommand((sub) =>
      sub
        .setName('list')
        .setDescription('Lihat daftar memo personal kamu')
        .addStringOption((opt) =>
          opt
            .setName('kategori')
            .setDescription('Filter berdasarkan kategori tertentu')
            .addChoices(
              { name: 'Preferensi', value: 'preferensi' },
              { name: 'Pekerjaan / Studi', value: 'pekerjaan' },
              { name: 'Hobi / Minat', value: 'hobi' },
              { name: 'Projek', value: 'projek' },
              { name: 'Umum / Lainnya', value: 'general' }
            )
        )
    )
    // ── Subcommand: search ──
    .addSubcommand((sub) =>
      sub
        .setName('search')
        .setDescription('Cari di antara memo-memo kamu')
        .addStringOption((opt) => opt.setName('query').setDescription('Kata kunci pencarian').setRequired(true))
    )
    // ── Subcommand: delete ──
    .addSubcommand((sub) =>
      sub
        .setName('delete')
        .setDescription('Hapus memo personal tertentu')
        .addStringOption((opt) =>
          opt.setName('nomor').setDescription('Nomor urut memo (cek dari /memo list) atau ID memo').setRequired(true)
        )
    )
    // ── Subcommand: clear ──
    .addSubcommand((sub) => sub.setName('clear').setDescription('Hapus seluruh memo personal kamu'))
    // ── Subcommand: server-add (Admin/ManageGuild) ──
    .addSubcommand((sub) =>
      sub
        .setName('server-add')
        .setDescription('(Admin) Tambah catatan/konteks resmi server untuk AI Dermist')
        .addStringOption((opt) =>
          opt.setName('teks').setDescription('Catatan server (aturan, info komunitas, dsb)').setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('kategori')
            .setDescription('Kategori catatan server')
            .addChoices(
              { name: 'Aturan', value: 'aturan' },
              { name: 'Info / FAQ', value: 'faq' },
              { name: 'Jadwal / Event', value: 'event' },
              { name: 'Umum', value: 'umum' }
            )
        )
    )
    // ── Subcommand: server-list ──
    .addSubcommand((sub) => sub.setName('server-list').setDescription('Lihat semua memo server global'))
    // ── Subcommand: server-delete (Admin/ManageGuild) ──
    .addSubcommand((sub) =>
      sub
        .setName('server-delete')
        .setDescription('(Admin) Hapus memo server tertentu')
        .addStringOption((opt) => opt.setName('nomor').setDescription('Nomor urut memo server').setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const userName = interaction.user.username;
    const guildId = interaction.guildId || 'global';

    // ── 1. ADD ──
    if (sub === 'add') {
      const text = interaction.options.getString('teks');
      const category = interaction.options.getString('kategori') || 'general';

      const memo = await addMemo(guildId, userId, userName, text, category);
      if (!memo) {
        return interaction.reply({
          embeds: [errorEmbed('Gagal Menyimpan', 'Memo serupa sudah pernah disimpan, atau teks mengandung pola yang tidak diizinkan.')],
          flags: MessageFlags.Ephemeral,
        });
      }

      return interaction.reply({
        embeds: [
          successEmbed(
            '📝 Memo Tersimpan!',
            `**Kategori:** \`[${memo.category}]\`\n**Isi:** ${memo.text}\n\n_Dermist akan mengingat ini saat mengobrol denganmu!_`
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    // ── 2. LIST ──
    if (sub === 'list') {
      const category = interaction.options.getString('kategori');
      const memos = await getMemos(guildId, userId, category);

      if (!memos.length) {
        return interaction.reply({
          embeds: [errorEmbed('Memo Kosong', 'Kamu belum memiliki catatan memo. Buat dengan `/memo add`.')],
          flags: MessageFlags.Ephemeral,
        });
      }

      const listStr = memos
        .map((m, idx) => `**#${idx + 1}** \`[${m.category || 'general'}]\` ${m.text}`)
        .join('\n\n');

      const embed = new EmbedBuilder()
        .setColor(config.embedColor)
        .setTitle(`📋 Memo Personal: ${userName}`)
        .setDescription(listStr.slice(0, 4000))
        .setFooter({ text: 'Untuk menghapus memo: /memo delete <nomor>' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    // ── 3. SEARCH ──
    if (sub === 'search') {
      const query = interaction.options.getString('query');
      const memos = await getMemos(guildId, userId);

      if (!memos.length) {
        return interaction.reply({
          embeds: [errorEmbed('Memo Kosong', 'Belum ada memo untuk dicari.')],
          flags: MessageFlags.Ephemeral,
        });
      }

      const qv = embed(query);
      const scored = memos
        .map((m) => ({ memo: m, score: cosine(qv, embed(m.text)) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      const resultStr = scored
        .map((x, idx) => `**#${idx + 1}** (Relevansi: ${(x.score * 100).toFixed(0)}%) \`[${x.memo.category}]\`\n${x.memo.text}`)
        .join('\n\n');

      const embed = new EmbedBuilder()
        .setColor(config.embedColor)
        .setTitle(`🔍 Hasil Pencarian Memo: "${query}"`)
        .setDescription(resultStr || 'Tidak ada memo yang cocok.')
        .setTimestamp();

      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    // ── 4. DELETE ──
    if (sub === 'delete') {
      const target = interaction.options.getString('nomor');
      const removed = await removeMemo(guildId, userId, target);

      if (!removed) {
        return interaction.reply({
          embeds: [errorEmbed('Gagal Menghapus', `Memo #${target} tidak ditemukan. Cek daftar di \`/memo list\`.`)],
          flags: MessageFlags.Ephemeral,
        });
      }

      return interaction.reply({
        embeds: [successEmbed('🗑️ Memo Dihapus', `Memo berikut telah dihapus:\n> ${removed.text}`)],
        flags: MessageFlags.Ephemeral,
      });
    }

    // ── 5. CLEAR ──
    if (sub === 'clear') {
      await clearMemos(guildId, userId);
      return interaction.reply({
        embeds: [successEmbed('🧹 Bersih!', 'Semua memo personal kamu telah dihapus.')],
        flags: MessageFlags.Ephemeral,
      });
    }

    // ── 6. SERVER-ADD (Admin Only) ──
    if (sub === 'server-add') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({
          embeds: [errorEmbed('Akses Ditolak', 'Hanya Admin / Pengelola Server yang dapat menambah memo server.')],
          flags: MessageFlags.Ephemeral,
        });
      }

      const text = interaction.options.getString('teks');
      const category = interaction.options.getString('kategori') || 'umum';

      const memo = await addServerMemo(guildId, userName, text, category);
      if (!memo) {
        return interaction.reply({
          embeds: [errorEmbed('Gagal Menyimpan', 'Memo server serupa sudah ada.')],
          flags: MessageFlags.Ephemeral,
        });
      }

      return interaction.reply({
        embeds: [
          successEmbed(
            '🌐 Memo Server Ditambahkan',
            `**Kategori:** \`[${memo.category}]\`\n**Isi:** ${memo.text}\n\n_Catatan ini akan menjadi pengetahuan bersama untuk AI Dermist di server ini._`
          ),
        ],
      });
    }

    // ── 7. SERVER-LIST ──
    if (sub === 'server-list') {
      const serverMemos = await getServerMemos(guildId);
      if (!serverMemos.length) {
        return interaction.reply({
          embeds: [errorEmbed('Belum Ada Memo Server', 'Server ini belum memiliki memo bersama. Admin dapat menambahkannya via `/memo server-add`.')],
          flags: MessageFlags.Ephemeral,
        });
      }

      const listStr = serverMemos
        .map((m, idx) => `**#${idx + 1}** \`[${m.category}]\` ${m.text} _(oleh ${m.by})_`)
        .join('\n\n');

      const embed = new EmbedBuilder()
        .setColor(config.embedColor)
        .setTitle(`🌐 Memo Bersama Server: ${interaction.guild?.name || 'Global'}`)
        .setDescription(listStr.slice(0, 4000))
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // ── 8. SERVER-DELETE (Admin Only) ──
    if (sub === 'server-delete') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({
          embeds: [errorEmbed('Akses Ditolak', 'Hanya Admin / Pengelola Server yang dapat menghapus memo server.')],
          flags: MessageFlags.Ephemeral,
        });
      }

      const target = interaction.options.getString('nomor');
      const removed = await removeServerMemo(guildId, target);

      if (!removed) {
        return interaction.reply({
          embeds: [errorEmbed('Tidak Ditemukan', `Memo server #${target} tidak ditemukan.`)],
          flags: MessageFlags.Ephemeral,
        });
      }

      return interaction.reply({
        embeds: [successEmbed('🗑️ Memo Server Dihapus', `Memo server berikut telah dihapus:\n> ${removed.text}`)],
      });
    }
  },
};
