import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';
import { sendLog } from '../../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Kunci channel (member tidak bisa kirim pesan)')
    .addChannelOption((opt) => opt.setName('channel').setDescription('Channel yang dikunci (kosongkan = channel ini)').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  async execute(interaction) {
    const channel = interaction.options.getChannel('channel') ?? interaction.channel;

    await channel.permissionOverwrites.edit(interaction.guild.id, { SendMessages: false });

    await interaction.reply({ embeds: [successEmbed('Channel Dikunci', `Channel <#${channel.id}> telah dikunci. Member tidak bisa mengirim pesan.`)] });

    await sendLog(interaction.guild, {
      title: '🔒 Channel Locked',
      description: `#${channel.name} dikunci.`,
      color: 0xed4245,
      user: interaction.user,
    });
  },
};
