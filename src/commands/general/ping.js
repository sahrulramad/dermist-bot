import { SlashCommandBuilder } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';

export default {
  data: new SlashCommandBuilder().setName('ping').setDescription('Cek latency bot'),
  async execute(interaction) {
    const response = await interaction.reply({
      embeds: [successEmbed('Pong! 🏓', 'Mengukur latency...')],
      withResponse: true,
    });
    const sent = response.resource?.message;
    const latency = (sent?.createdTimestamp ?? Date.now()) - interaction.createdTimestamp;
    await interaction.editReply({
      embeds: [
        successEmbed('Pong! 🏓', `**Bot Latency:** ${latency}ms\n**API Latency:** ${Math.round(interaction.client.ws.ping)}ms`),
      ],
    });
  },
};
