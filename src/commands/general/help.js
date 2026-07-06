import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { config } from '../../config.js';

export default {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Tampilkan semua perintah Dermist'),
  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(config.embedColor)
      .setTitle('🤖 Daftar Perintah Dermist')
      .setDescription(`Total **20 command** tersedia. Klik perintah untuk pakai.`)
      .addFields(
        {
          name: '🤖 AI (Cloudflare Workers AI)',
          value: '`/ask` — Tanya apa saja ke AI\n`/translate` — Terjemahkan teks (12 bahasa)\n`/remember` — Simpan fakta tentang kamu\n`/facts` — Lihat memory bot + skills aktif',
          inline: false,
        },
        {
          name: '⚖️ Moderasi',
          value: '`/kick` — Kick member\n`/ban` — Ban member\n`/mute` — Timeout (60s–7hari)\n`/unmute` — Hapus timeout\n`/warn` — Peringatan (auto-mute di 3x)\n`/purge` — Hapus 1-100 pesan',
          inline: false,
        },
        {
          name: '📁 Channel Management',
          value: '`/create-channel` — Buat text/voice/dll\n`/create-category` — Buat kategori\n`/delete-channel` — Hapus channel\n`/rename-channel` — Ubah nama\n`/move-channel` — Pindah kategori\n`/lock` — Kunci channel\n`/unlock` — Buka kunci',
          inline: false,
        },
        {
          name: 'ℹ️ General',
          value: '`/ping` — Cek latency bot\n`/serverinfo` — Info server\n`/setup` — Setup channel admin & publik\n`/help` — Lihat perintah ini',
          inline: false,
        },
        {
          name: '🧠 AI Agent (Mention)',
          value: 'Mention `@Dermist` + perintah natural:\n• "mute Zan 10 menit, spam"\n• "kasih info member Zan"\n• "hapus 20 pesan terakhir"\n• Bot juga auto-detect spam & toxic',
          inline: false,
        },
        {
          name: '🔒 Notifikasi',
          value: 'Setelah `/setup`, bot kirim:\n• **#admin-dermist** — laporan detail moderasi\n• **#chat-dermist** — info ringkas untuk member',
          inline: false,
        },
      )
      .setFooter({ text: 'Dermist Bot • Powered by Cloudflare Workers AI' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
