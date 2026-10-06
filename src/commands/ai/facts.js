import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { getFacts, getMemos, getServerMemos } from '../../utils/memory.js';
import { config } from '../../config.js';
import { listSkills } from '../../utils/skills.js';

export default {
  data: new SlashCommandBuilder()
    .setName('facts')
    .setDescription('Lihat fakta & memo yang bot ingat tentang kamu dan server ini'),
  async execute(interaction) {
    const userId = interaction.user.id;
    const guildId = interaction.guildId;

    const [facts, userMemos, serverMemos] = await Promise.all([
      getFacts(userId),
      getMemos(guildId, userId),
      getServerMemos(guildId),
    ]);
    const skills = listSkills();

    const embed = new EmbedBuilder()
      .setColor(config.embedColor)
      .setTitle('🧠 Memory System — Dermist')
      .setDescription('Ringkasan ingatan yang disimpan di Cloudflare KV:')
      .setTimestamp();

    // Gabungkan facts & user memos
    const personalItems = [
      ...userMemos.map((m) => `• [${m.category || 'memo'}] ${m.text}`),
      ...facts.map((f) => `• ${f.text || f}`),
    ];

    embed.addFields({
      name: `👤 Ingatan tentang ${interaction.user.username} (${personalItems.length})`,
      value: personalItems.length ? personalItems.slice(0, 10).join('\n') : '_Belum ada ingatan tersimpan. Gunakan `/memo add` atau ngobrol dengan Dermist!_',
      inline: false,
    });

    if (serverMemos.length) {
      embed.addFields({
        name: `🌐 Catatan Server (${serverMemos.length})`,
        value: serverMemos.slice(0, 5).map((s) => `• [${s.category}] ${s.text}`).join('\n'),
        inline: false,
      });
    }

    embed.addFields({
      name: '🎯 Skills Aktif',
      value: skills.length ? skills.map((s) => `\`${s}\``).join(' ') : '_(tidak ada)_',
      inline: false,
    });

    embed.setFooter({ text: 'Tips: Gunakan /memo untuk mengelola catatan personal & server.' });

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
