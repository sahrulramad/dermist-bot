import { SlashCommandBuilder } from 'discord.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';
import { askAI } from '../../utils/cloudflare-ai.js';
import { isInjection } from '../../utils/guards.js';
import { getPersonaBlock } from '../../utils/persona.js';
import { getSkillsBlock } from '../../utils/skills.js';
import { factsBlock } from '../../utils/memory.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ask')
    .setDescription('Tanya apa saja ke AI (Cloudflare Workers AI)')
    .addStringOption((opt) => opt.setName('pertanyaan').setDescription('Pertanyaan kamu').setRequired(true)),
  async execute(interaction) {
    const question = interaction.options.getString('pertanyaan');

    if (isInjection(question)) {
      return interaction.reply({ embeds: [errorEmbed('Diblokir', 'Pertanyaan mengandung pola yang mencoba memanipulasi AI.')], ephemeral: true });
    }

    await interaction.deferReply();

    try {
      const persona = getPersonaBlock();
      const skills = getSkillsBlock(question);
      const facts = await factsBlock(interaction.user.id, question);

      const systemPrompt = `Kamu adalah Dermist, asisten AI di server Discord.${persona}${skills}${facts}\n\nJawab pertanyaan dengan akurat, faktual, dan ringkas. Jangan mengarang informasi. Gunakan bahasa yang sama dengan user.`;

      const answer = await askAI(question, systemPrompt);

      const truncated = answer.length > 1900 ? answer.slice(0, 1900) + '...' : answer;
      await interaction.editReply({ embeds: [successEmbed('💬 AI Menjawab', truncated)] });
    } catch (err) {
      await interaction.editReply({ embeds: [errorEmbed('AI Error', `\`${err.message}\``)] });
    }
  },
};
