import { SlashCommandBuilder } from 'discord.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';
import { addFact, getFacts } from '../../utils/memory.js';

export default {
  data: new SlashCommandBuilder()
    .setName('remember')
    .setDescription('Minta bot mengingat sebuah fakta tentang kamu')
    .addStringOption((opt) => opt.setName('fakta').setDescription('Fakta yang ingin diingat bot (mis. "Aku suka kopi")').setRequired(true)),
  async execute(interaction) {
    const fact = interaction.options.getString('fakta').trim();
    const userId = interaction.user.id;
    const userName = interaction.user.username;

    const added = await addFact(userId, userName, fact);

    if (added) {
      await interaction.reply({
        embeds: [successEmbed('Tersimpan di Memory', `Oke, aku ingat: **${fact}**\nNanti aku pakai info ini buat personalisasi jawaban aku. 🧠`)],
      });
    } else {
      const existing = await getFacts(userId);
      if (existing.includes(fact)) {
        await interaction.reply({ embeds: [errorEmbed('Sudah Ada', 'Fakta itu udah aku simpan sebelumnya.')] });
      } else {
        await interaction.reply({ embeds: [errorEmbed('Gagal', 'Fakta tidak bisa disimpan (mungkin terlalu panjang atau mengandung pola terlarang).')] });
      }
    }
  },
};
