import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { getVaultMeta, searchVault, getVaultIndex } from '../../utils/vault.js';
import { config } from '../../config.js';
import { errorEmbed } from '../../utils/embeds.js';

export default {
  data: new SlashCommandBuilder()
    .setName('vault')
    .setDescription('Akses & cari informasi dari Obsidian Knowledge Base server')
    // ── Subcommand: search ──
    .addSubcommand((sub) =>
      sub
        .setName('search')
        .setDescription('Cari topik tertentu di catatan Obsidian Knowledge Base')
        .addStringOption((opt) => opt.setName('query').setDescription('Kata kunci atau pertanyaan').setRequired(true))
    )
    // ── Subcommand: status ──
    .addSubcommand((sub) =>
      sub.setName('status').setDescription('Lihat status sinkronisasi catatan Obsidian ke Cloudflare KV')
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    // ── 1. STATUS ──
    if (sub === 'status') {
      const meta = await getVaultMeta();
      const index = await getVaultIndex();

      if (!meta && (!index || !index.length)) {
        return interaction.reply({
          embeds: [
            errorEmbed(
              'Belum Ada Knowledge Base',
              'Vault Obsidian belum pernah disinkronkan ke Cloudflare KV.\nJalankan `npm run vault:sync` di terminal laptop untuk memulai sinkronisasi.'
            ),
          ],
          flags: MessageFlags.Ephemeral,
        });
      }

      const lastSyncTime = meta?.lastSyncAt
        ? `<t:${Math.floor(meta.lastSyncAt / 1000)}:F> (<t:${Math.floor(meta.lastSyncAt / 1000)}:R>)`
        : 'Tidak diketahui';

      const embed = new EmbedBuilder()
        .setColor(config.embedColor)
        .setTitle('📚 Obsidian Vault Knowledge Base Status')
        .setDescription('Informasi basis data pengetahuan yang tersimpan di Cloudflare KV:')
        .addFields(
          { name: '📄 Total Dokumen/File', value: `${meta?.totalFiles || index.length} file`, inline: true },
          { name: '✂️ Total Chunk Terindeks', value: `${meta?.totalChunks || index.length} chunks`, inline: true },
          { name: '📦 Ukuran Data', value: meta?.fileSizeKB ? `${meta.fileSizeKB} KB` : 'Tersedia', inline: true },
          { name: '🕒 Terakhir Disinkronkan', value: lastSyncTime, inline: false },
          {
            name: '📂 Lokasi Vault Sumber',
            value: meta?.vaultPath ? `\`${meta.vaultPath}\`` : '_(lokal laptop)_',
            inline: false,
          }
        )
        .setFooter({ text: 'Gunakan "npm run vault:sync" untuk memperbarui catatan dari laptop' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // ── 2. SEARCH ──
    if (sub === 'search') {
      const query = interaction.options.getString('query');
      await interaction.deferReply();

      const results = await searchVault(query, 3, 0.15);

      if (!results.length) {
        return interaction.editReply({
          embeds: [
            errorEmbed(
              'Tidak Ditemukan',
              `Tidak ada catatan di Obsidian Knowledge Base yang relevan dengan: **"${query}"**.\nCoba kata kunci lain atau periksa sinkronisasi dengan \`/vault status\`.`
            ),
          ],
        });
      }

      const embed = new EmbedBuilder()
        .setColor(config.embedColor)
        .setTitle(`🔍 Hasil Pencarian Knowledge Base: "${query}"`)
        .setDescription(`Menemukan **${results.length}** potongan catatan relevan:`)
        .setTimestamp();

      for (const res of results) {
        const preview = res.content.length > 500 ? res.content.slice(0, 500) + '...' : res.content;
        const relevance = Math.min(100, Math.round(res.score * 100));

        embed.addFields({
          name: `📑 ${res.title} > ${res.heading} (${relevance}% Relevan)`,
          value: `\`File: ${res.file}\`\n${preview}`,
          inline: false,
        });
      }

      embed.setFooter({ text: 'Dermist juga secara otomatis memakai pengetahuan ini saat kamu bertanya via @Dermist' });

      return interaction.editReply({ embeds: [embed] });
    }
  },
};
