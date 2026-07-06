import { SlashCommandBuilder } from 'discord.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';
import { translateText } from '../../utils/cloudflare-ai.js';

export default {
  data: new SlashCommandBuilder()
    .setName('translate')
    .setDescription('Terjemahkan teks ke bahasa lain dengan AI')
    .addStringOption((opt) => opt.setName('teks').setDescription('Teks yang akan diterjemahkan').setRequired(true))
    .addStringOption((opt) =>
      opt.setName('bahasa').setDescription('Bahasa tujuan').setRequired(true)
        .addChoices(
          { name: '🇬🇧 English', value: 'English' },
          { name: '🇮🇩 Indonesian', value: 'Indonesian' },
          { name: '🇯🇵 Japanese', value: 'Japanese' },
          { name: '🇰🇷 Korean', value: 'Korean' },
          { name: '🇨🇳 Chinese', value: 'Chinese' },
          { name: '🇸🇦 Arabic', value: 'Arabic' },
          { name: '🇪🇸 Spanish', value: 'Spanish' },
          { name: '🇫🇷 French', value: 'French' },
          { name: '🇩🇪 German', value: 'German' },
          { name: '🇮🇳 Hindi', value: 'Hindi' },
          { name: '🇷🇺 Russian', value: 'Russian' },
          { name: '🇹🇭 Thai', value: 'Thai' },
        ),
    ),
  async execute(interaction) {
    const text = interaction.options.getString('teks');
    const targetLang = interaction.options.getString('bahasa');

    await interaction.deferReply();

    try {
      const translated = await translateText(text, targetLang);
      const display = translated.length > 1900 ? translated.slice(0, 1900) + '...' : translated;

      await interaction.editReply({
        embeds: [successEmbed(`🌐 Diterjemahkan ke ${targetLang}`, display)],
      });
    } catch (err) {
      await interaction.editReply({ embeds: [errorEmbed('Translate Error', `\`${err.message}\``)] });
    }
  },
};
