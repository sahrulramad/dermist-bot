import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getFacts, clearHistory } from '../../utils/memory.js';
import { config } from '../../config.js';
import { listSkills } from '../../utils/skills.js';

export default {
  data: new SlashCommandBuilder()
    .setName('facts')
    .setDescription('Lihat fakta yang bot ingat tentang kamu + info sistem'),
  async execute(interaction) {
    const facts = await getFacts(interaction.user.id);
    const skills = listSkills();

    const embed = new EmbedBuilder()
      .setColor(config.embedColor)
      .setTitle('🧠 Memory Dermist')
      .addFields(
        {
          name: `📋 Fakta tentang ${interaction.user.username}`,
          value: facts.length ? facts.map((f) => `• ${f}`).join('\n') : '(belum ada fakta tersimpan)',
          inline: false,
        },
        {
          name: '🎯 Skills Aktif',
          value: skills.length ? skills.map((s) => `• ${s}`).join('\n') : '(tidak ada)',
          inline: false,
        },
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
