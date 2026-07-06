import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { sendLog } from '../../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Buka kunci channel')
    .addChannelOption((opt) => opt.setName('channel').setDescription('Channel yang dibuka (kosongkan = channel ini)').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  async execute(interaction) {
    const channel = interaction.options.getChannel('channel') ?? interaction.channel;

    await channel.permissionOverwrites.edit(interaction.guild.id, { SendMessages: null });

    await interaction.reply({ embeds: [successEmbed('Channel Dibuka', `Channel <#${channel.id}> telah dibuka kuncinya.`)] });

    await sendLog(interaction.guild, {
      title: '🔓 Channel Unlocked',
      description: `#${channel.name} dibuka.`,
      color: 0x57f287,
      user: interaction.user,
    });
  },
};
