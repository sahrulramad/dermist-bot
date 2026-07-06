import { SlashCommandBuilder, ChannelType, PermissionFlagsBits } from 'discord.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';
import { sendLog } from '../../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('move-channel')
    .setDescription('Pindahkan channel ke kategori lain')
    .addChannelOption((opt) => opt.setName('channel').setDescription('Channel yang akan dipindah').setRequired(true))
    .addChannelOption((opt) =>
      opt.setName('kategori').setDescription('Kategori tujuan').setRequired(true).addChannelTypes(ChannelType.GuildCategory),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    const category = interaction.options.getChannel('kategori');

    await channel.setParent(category.id);

    await interaction.reply({
      embeds: [successEmbed('Channel Dipindah', `Channel **#${channel.name}** dipindah ke kategori **${category.name}**`)],
    });

    await sendLog(interaction.guild, {
      title: '📦 Channel Moved',
      description: `#${channel.name} dipindah ke kategori ${category.name}`,
      color: 0xfee75c,
      user: interaction.user,
      fields: [
        { name: 'Channel', value: channel.name, inline: true },
        { name: 'Kategori Baru', value: category.name, inline: true },
      ],
    });
  },
};
