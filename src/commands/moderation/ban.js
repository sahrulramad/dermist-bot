import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';
import { sendLog } from '../../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban member dari server')
    .addUserOption((opt) => opt.setName('member').setDescription('Member yang akan di-ban').setRequired(true))
    .addStringOption((opt) => opt.setName('alasan').setDescription('Alasan ban').setRequired(false))
    .addIntegerOption((opt) =>
      opt.setName('hari').setDescription('Hapus pesan X hari terakhir (0-7)').setMinValue(0).setMaxValue(7).setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  async execute(interaction) {
    const target = interaction.options.getMember('member');
    const reason = interaction.options.getString('alasan') ?? 'Tidak ada alasan';
    const days = interaction.options.getInteger('hari') ?? 0;

    if (!target) {
      return interaction.reply({ embeds: [errorEmbed('Gagal', 'Member tidak ditemukan di server.')], flags: MessageFlags.Ephemeral });
    }
    if (target.id === interaction.user.id) {
      return interaction.reply({ embeds: [errorEmbed('Gagal', 'Kamu tidak bisa ban diri sendiri.')], flags: MessageFlags.Ephemeral });
    }
    if (!target.bannable) {
      return interaction.reply({ embeds: [errorEmbed('Gagal', 'Bot tidak punya izin untuk ban member ini.')], flags: MessageFlags.Ephemeral });
    }

    await target.ban({ deleteMessageSeconds: days * 86400, reason: `oleh ${interaction.user.tag} — ${reason}` });
    await interaction.reply({
      embeds: [successEmbed('Member Diban', `${target.user.tag} telah di-ban.\n**Alasan:** ${reason}${days ? `\n**Hapus pesan:** ${days} hari` : ''}`)],
    });

    await sendLog(interaction.guild, {
      title: '🔨 Member Banned',
      description: `${target.user.tag} (<@${target.id}>) di-ban.`,
      color: 0xed4245,
      user: interaction.user,
      fields: [
        { name: 'Target', value: `${target.user.tag} (<@${target.id}>)`, inline: true },
        { name: 'Alasan', value: reason, inline: false },
        ...(days ? [{ name: 'Hapus Pesan', value: `${days} hari`, inline: true }] : []),
      ],
    });
  },
};
