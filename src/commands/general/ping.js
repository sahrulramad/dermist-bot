import { SlashCommandBuilder } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';

export default {
  data: new SlashCommandBuilder().setName('ping').setDescription('Cek latency bot'),
  async execute(interaction) {
    const sent = await interaction.reply({ embeds: [successEmbed('Pong! 🏓', 'Mengukur latency...')], fetchReply: true });
    const latency = sent.createdTimestamp - interaction.createdTimestamp;
    await interaction.editReply({
      embeds: [
        successEmbed('Pong! 🏓', `**Bot Latency:** ${latency}ms\n**API Latency:** ${Math.round(interaction.client.ws.ping)}ms`),
      ],
    });
  },
};
