import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';
import { sendLog } from '../../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('rename-channel')
    .setDescription('Ubah nama channel')
    .addChannelOption((opt) => opt.setName('channel').setDescription('Channel yang akan diubah').setRequired(true))
    .addStringOption((opt) => opt.setName('nama').setDescription('Nama baru channel').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    const newName = interaction.options.getString('nama');
    const oldName = channel.name;

    await channel.setName(newName);

    await interaction.reply({
      embeds: [successEmbed('Channel Direname', `Channel **#${oldName}** → **#${newName}**`)],
    });

    await sendLog(interaction.guild, {
      title: '✏️ Channel Renamed',
      description: `#${oldName} → #${newName}`,
      color: 0xfee75c,
      user: interaction.user,
      fields: [
        { name: 'Nama Lama', value: oldName, inline: true },
        { name: 'Nama Baru', value: newName, inline: true },
      ],
    });
  },
};
