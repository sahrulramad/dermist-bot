import { Events, MessageFlags } from 'discord.js';
import { errorEmbed } from '../utils/embeds.js';
import { log } from '../utils/logger.js';

export default {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) {
      log(`Command tidak ditemukan: /${interaction.commandName}`, 'error');
      return;
    }

    try {
      log(`${interaction.user.tag} menjalankan /${interaction.commandName}`, 'info');
      await command.execute(interaction);
    } catch (err) {
      log(`Error di /${interaction.commandName}: ${err.stack}`, 'error');
      const reply = { embeds: [errorEmbed('Terjadi Error', `\`${err.message}\``)], flags: MessageFlags.Ephemeral };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply).catch(() => {});
      } else {
        await interaction.reply(reply).catch(() => {});
      }
    }
  },
};
