import { SlashCommandBuilder } from 'discord.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';
import { addFact, getFacts } from '../../utils/memory.js';

export default {
  data: new SlashCommandBuilder()
    .setName('remember')
    .setDescription('Minta bot mengingat sebuah fakta tentang kamu (Legacy: rekomendasi gunakan /memo)')
    .addStringOption((opt) =>
      opt.setName('fakta')
        .setDescription('Fakta yang ingin diingat bot (mis. "Aku suka minum kopi espresso")')
        .setRequired(true)
    ),
  async execute(interaction) {
    const fact = interaction.options.getString('fakta').trim();
    const userId = interaction.user.id;
    const userName = interaction.user.username;

    const added = await addFact(userId, userName, fact);

    if (added) {
      await interaction.reply({
        embeds: [
          successEmbed(
            '🧠 Tersimpan di Memory',
            `Oke, aku ingat: **${fact}**\n\nInfo ini akan dipakai untuk personalisasi jawaban saat kamu ngobrol dengan Dermist.\n_Tips: Kamu juga bisa pakai \`/memo add\` untuk kategori yang lebih rapi!_`
          ),
        ],
      });
    } else {
      const existing = await getFacts(userId);
      const isDuplicate = existing.some((f) => (f.text || f) === fact);

      if (isDuplicate) {
        await interaction.reply({
          embeds: [errorEmbed('Sudah Ada', 'Fakta tersebut sudah pernah aku simpan sebelumnya.')],
        });
      } else {
        await interaction.reply({
          embeds: [
            errorEmbed(
              'Gagal Menyimpan',
              'Fakta tidak bisa disimpan (mungkin terlalu panjang atau mengandung kata yang dilarang).'
            ),
          ],
        });
      }
    }
  },
};
