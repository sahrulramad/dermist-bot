import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { config } from '../../config.js';

export default {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Tampilkan buku panduan & seluruh perintah Dermist Bot'),
  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(config.embedColor)
      .setTitle('📖 Buku Panduan & Daftar Perintah — Dermist Bot')
      .setDescription(
        `Halo <@${interaction.user.id}>! Dermist adalah bot All-in-One: **AI Assistant (Llama 3.3 70B)** + **Smart Memory** + **Auto-Moderasi**.\n\nTotal **24 slash command** tersedia:`
      )
      .addFields(
        {
          name: '🤖 1. AI Assistant & Obrolan',
          value:
            '• **Mention** `@Dermist <pesan>` — Ngobrol langsung dengan AI\n' +
            '• `/ask <pertanyaan>` — Tanya apa saja ke AI\n' +
            '• `/translate <teks> <bahasa>` — Terjemahkan teks otomatis',
          inline: false,
        },
        {
          name: '🧠 2. Smart Memory (Memo Layer)',
          value:
            '• `/memo add <teks> [kategori]` — Simpan preferensi kamu agar bot ingat\n' +
            '• `/memo list [kategori]` — Lihat daftar catatan memomu\n' +
            '• `/memo search <query>` — Cari catatan berdasarkan arti yang mirip\n' +
            '• `/memo delete <nomor>` — Hapus catatan memo\n' +
            '• `/memo server-add <teks>` — *(Admin)* Catatan penting server agar AI tahu\n' +
            '• `/facts` — Ringkasan apa yang bot ketahui tentang dirimu',
          inline: false,
        },
        {
          name: '⚙️ 3. Setup & Server Management',
          value:
            '• `/setup-server <template>` — **Setup otomatis seluruh server** (Roles, Channels, Rules)\n' +
            '• `/setup` — Setup cepat channel khusus bot\n' +
            '• `/create-channel`, `/create-category`, `/delete-channel` — Kelola channel\n' +
            '• `/rename-channel`, `/move-channel`, `/lock`, `/unlock` — Pengaturan channel',
          inline: false,
        },
        {
          name: '🛡️ 4. Moderasi & Proteksi Server (Staff)',
          value:
            '• `/warn <user> <alasan>` — Peringatan (auto-mute di 2x & 3x warning)\n' +
            '• `/mute <user> <durasi> <alasan>` — Timeout member sementara\n' +
            '• `/unmute <user>` — Batalkan status timeout\n' +
            '• `/kick <user>` & `/ban <user>` — Tindakan tegas pengeluaran member\n' +
            '• `/note add <user> <catatan>` — Catatan rahasia staf tentang member\n' +
            '• `/purge <jumlah>` — Hapus 1-100 pesan sekaligus',
          inline: false,
        },
        {
          name: 'ℹ️ 5. Info & Utilitas',
          value:
            '• `/ping` — Cek latency & koneksi bot ke Discord API\n' +
            '• `/serverinfo` — Tampilkan statistik lengkap server ini\n' +
            '• `/help` — Buka buku panduan ini',
          inline: false,
        }
      )
      .setFooter({ text: 'Dermist Bot • Powered by Cloudflare Workers AI & KV' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
