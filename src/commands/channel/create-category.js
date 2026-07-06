import { SlashCommandBuilder, ChannelType, PermissionFlagsBits } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { sendLog } from '../../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('create-category')
    .setDescription('Buat kategori channel baru')
    .addStringOption((opt) => opt.setName('nama').setDescription('Nama kategori').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  async execute(interaction) {
    const name = interaction.options.getString('nama');
    const category = await interaction.guild.channels.create({ name, type: ChannelType.GuildCategory });

    await interaction.reply({ embeds: [successEmbed('Kategori Dibuat', `Kategori **${category.name}** berhasil dibuat.`)] });

    await sendLog(interaction.guild, {
      title: '📁 Category Created',
      description: `Kategori ${category.name} dibuat.`,
      color: 0x57f287,
      user: interaction.user,
    });
  },
};
