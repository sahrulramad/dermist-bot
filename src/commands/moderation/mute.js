import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';
import { sendLog } from '../../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Timeout (mute) member untuk durasi tertentu')
    .addUserOption((opt) => opt.setName('member').setDescription('Member yang akan di-mute').setRequired(true))
    .addIntegerOption((opt) =>
      opt.setName('durasi').setDescription('Durasi mute').setRequired(true)
        .addChoices(
          { name: '60 detik', value: 60 },
          { name: '5 menit', value: 300 },
          { name: '10 menit', value: 600 },
          { name: '1 jam', value: 3600 },
          { name: '6 jam', value: 21600 },
          { name: '12 jam', value: 43200 },
          { name: '1 hari', value: 86400 },
          { name: '7 hari', value: 604800 },
        ),
    )
    .addStringOption((opt) => opt.setName('alasan').setDescription('Alasan mute').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  async execute(interaction) {
    const target = interaction.options.getMember('member');
    const duration = interaction.options.getInteger('durasi');
    const reason = interaction.options.getString('alasan') ?? 'Tidak ada alasan';

    if (!target) {
      return interaction.reply({ embeds: [errorEmbed('Gagal', 'Member tidak ditemukan.')], ephemeral: true });
    }
    if (target.id === interaction.user.id) {
      return interaction.reply({ embeds: [errorEmbed('Gagal', 'Kamu tidak bisa mute diri sendiri.')], ephemeral: true });
    }
    if (!target.moderatable) {
      return interaction.reply({ embeds: [errorEmbed('Gagal', 'Bot tidak punya izin untuk mute member ini.')], ephemeral: true });
    }

    await target.timeout(duration * 1000, `oleh ${interaction.user.tag} — ${reason}`);
    await interaction.reply({
      embeds: [successEmbed('Member Dimute', `${target.user.tag} telah di-mute selama **${duration} detik**.\n**Alasan:** ${reason}`)],
    });

    await sendLog(interaction.guild, {
      title: '🤐 Member Muted',
      description: `${target.user.tag} (<@${target.id}>) di-timeout.`,
      color: 0xfee75c,
      user: interaction.user,
      fields: [
        { name: 'Target', value: `${target.user.tag} (<@${target.id}>)`, inline: true },
        { name: 'Durasi', value: `${duration} detik`, inline: true },
        { name: 'Alasan', value: reason, inline: false },
      ],
    });
  },
};
