import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';
import { sendLog } from '../../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Hapus sejumlah pesan terbaru di channel ini')
    .addIntegerOption((opt) =>
      opt.setName('jumlah').setDescription('Jumlah pesan yang dihapus (1-100)').setRequired(true).setMinValue(1).setMaxValue(100),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  async execute(interaction) {
    const amount = interaction.options.getInteger('jumlah');

    if (!interaction.channel?.bulkDeletable) {
      return interaction.reply({ embeds: [errorEmbed('Gagal', 'Bot tidak bisa menghapus pesan di channel ini.')], ephemeral: true });
    }

    const deleted = await interaction.channel.bulkDelete(amount, true);

    await interaction.reply({
      embeds: [successEmbed('Pesan Dihapus', `Berhasil menghapus **${deleted.size}** pesan.`)],
      ephemeral: true,
    });

    await sendLog(interaction.guild, {
      title: '🧹 Messages Purged',
      description: `${deleted.size} pesan dihapus di <#${interaction.channelId}>.`,
      color: 0xfee75c,
      user: interaction.user,
      fields: [
        { name: 'Channel', value: `<#${interaction.channelId}>`, inline: true },
        { name: 'Jumlah', value: `${deleted.size}`, inline: true },
      ],
    });
  },
};
