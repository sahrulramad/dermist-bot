import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';
import { sendLog } from '../../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Hapus timeout (unmute) member')
    .addUserOption((opt) => opt.setName('member').setDescription('Member yang akan di-unmute').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  async execute(interaction) {
    const target = interaction.options.getMember('member');

    if (!target) {
      return interaction.reply({ embeds: [errorEmbed('Gagal', 'Member tidak ditemukan.')], flags: MessageFlags.Ephemeral });
    }
    if (!target.isCommunicationDisabled()) {
      return interaction.reply({ embeds: [errorEmbed('Gagal', 'Member ini sedang tidak di-mute.')], flags: MessageFlags.Ephemeral });
    }

    await target.timeout(null);
    await interaction.reply({ embeds: [successEmbed('Member Diunmute', `${target.user.tag} telah di-unmute.`)] });

    await sendLog(interaction.guild, {
      title: '🔊 Member Unmuted',
      description: `${target.user.tag} (<@${target.id}>) timeout-nya dihapus.`,
      color: 0x57f287,
      user: interaction.user,
    });
  },
};
