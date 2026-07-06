import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';
import { sendLog } from '../../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('delete-channel')
    .setDescription('Hapus channel')
    .addChannelOption((opt) => opt.setName('channel').setDescription('Channel yang akan dihapus').setRequired(true))
    .addStringOption((opt) => opt.setName('alasan').setDescription('Alasan penghapusan').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    const reason = interaction.options.getString('alasan') ?? 'Tidak ada alasan';

    if (channel.id === interaction.channel?.id) {
      return interaction.reply({ embeds: [errorEmbed('Gagal', 'Tidak bisa menghapus channel tempat kamu menjalankan command ini.')], ephemeral: true });
    }

    const name = channel.name;
    await channel.delete(reason);

    await interaction.reply({
      embeds: [successEmbed('Channel Dihapus', `Channel **#${name}** berhasil dihapus.\n**Alasan:** ${reason}`)],
    });

    await sendLog(interaction.guild, {
      title: '🗑️ Channel Deleted',
      description: `Channel #${name} dihapus.`,
      color: 0xed4245,
      user: interaction.user,
      fields: [
        { name: 'Channel', value: name, inline: true },
        { name: 'Alasan', value: reason, inline: false },
      ],
    });
  },
};
