import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';
import { sendLog } from '../../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Keluarkan member dari server')
    .addUserOption((opt) => opt.setName('member').setDescription('Member yang akan di-kick').setRequired(true))
    .addStringOption((opt) => opt.setName('alasan').setDescription('Alasan kick').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
  async execute(interaction) {
    const target = interaction.options.getMember('member');
    const reason = interaction.options.getString('alasan') ?? 'Tidak ada alasan';

    if (!target) {
      return interaction.reply({ embeds: [errorEmbed('Gagal', 'Member tidak ditemukan di server.')], ephemeral: true });
    }
    if (target.id === interaction.user.id) {
      return interaction.reply({ embeds: [errorEmbed('Gagal', 'Kamu tidak bisa kick diri sendiri.')], ephemeral: true });
    }
    if (!target.kickable) {
      return interaction.reply({ embeds: [errorEmbed('Gagal', 'Bot tidak punya izin untuk kick member ini (role terlalu tinggi).')], ephemeral: true });
    }

    await target.kick(`oleh ${interaction.user.tag} — ${reason}`);
    await interaction.reply({ embeds: [successEmbed('Member Dikick', `${target.user.tag} telah di-kick.\n**Alasan:** ${reason}`)] });

    await sendLog(interaction.guild, {
      title: '👢 Member Kicked',
      description: `${target.user.tag} (<@${target.id}>) di-kick.`,
      color: 0xfee75c,
      user: interaction.user,
      fields: [
        { name: 'Target', value: `${target.user.tag} (<@${target.id}>)`, inline: true },
        { name: 'Alasan', value: reason, inline: false },
      ],
    });
  },
};
