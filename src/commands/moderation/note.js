import { SlashCommandBuilder, EmbedBuilder, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { getAdminNotes, addAdminNote, clearAdminNotes } from '../../utils/memory.js';
import { config } from '../../config.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';

export default {
  data: new SlashCommandBuilder()
    .setName('note')
    .setDescription('Kelola catatan rahasia moderator tentang seorang member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Tambah catatan tentang member')
        .addUserOption((opt) => opt.setName('user').setDescription('Member yang dicatat').setRequired(true))
        .addStringOption((opt) => opt.setName('catatan').setDescription('Isi catatan').setRequired(true))
        .addStringOption((opt) =>
          opt
            .setName('tipe')
            .setDescription('Tipe catatan')
            .addChoices(
              { name: 'Info / Umum', value: 'info' },
              { name: 'Peringatan / Warning', value: 'warning' },
              { name: 'Perlu Dipantau (Watch)', value: 'pantau' }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('list')
        .setDescription('Lihat catatan tentang member tertentu')
        .addUserOption((opt) => opt.setName('user').setDescription('Member yang ingin dicek').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('clear')
        .setDescription('Hapus seluruh catatan tentang member tertentu')
        .addUserOption((opt) => opt.setName('user').setDescription('Member yang ingin dibersihkan catatannya').setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const targetUser = interaction.options.getUser('user');
    const guildId = interaction.guildId || 'global';
    const authorName = interaction.user.username;

    if (sub === 'add') {
      const text = interaction.options.getString('catatan');
      const type = interaction.options.getString('tipe') || 'info';

      const note = await addAdminNote(guildId, targetUser.id, authorName, text, type);

      return interaction.reply({
        embeds: [
          successEmbed(
            '📌 Catatan Disimpan',
            `Catatan untuk **${targetUser.tag}** berhasil disimpan.\n**Tipe:** \`[${note.type}]\`\n**Isi:** ${note.text}`
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (sub === 'list') {
      const notes = await getAdminNotes(guildId, targetUser.id);

      if (!notes.length) {
        return interaction.reply({
          embeds: [errorEmbed('Tidak Ada Catatan', `Belum ada catatan moderator untuk **${targetUser.tag}**.`)],
          flags: MessageFlags.Ephemeral,
        });
      }

      const listStr = notes
        .map(
          (n, idx) =>
            `**#${idx + 1}** \`[${n.type.toUpperCase()}]\` ${n.text}\n└ _Dicatat oleh ${n.by} pada <t:${Math.floor(
              n.at / 1000
            )}:R>_`
        )
        .join('\n\n');

      const embed = new EmbedBuilder()
        .setColor(config.embedColor)
        .setTitle(`🛡️ Catatan Mod untuk: ${targetUser.tag}`)
        .setDescription(listStr.slice(0, 4000))
        .setThumbnail(targetUser.displayAvatarURL())
        .setTimestamp();

      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    if (sub === 'clear') {
      await clearAdminNotes(guildId, targetUser.id);
      return interaction.reply({
        embeds: [successEmbed('🧹 Catatan Dihapus', `Semua catatan moderator untuk **${targetUser.tag}** telah dihapus.`)],
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
