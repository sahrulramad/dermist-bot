import { SlashCommandBuilder, ChannelType, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';
import { config } from '../../config.js';
import { log } from '../../utils/logger.js';

const KV_BASE = `https://api.cloudflare.com/client/v4/accounts/${config.cfAccountId}/storage/kv/namespaces/${config.cfKvNamespaceId}/values`;
const KV_HEADERS = { Authorization: `Bearer ${config.cfKvToken || config.cfApiToken}` };

async function kvPut(key, value) {
  await fetch(`${KV_BASE}/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: { ...KV_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  });
}

export async function getBotChannels() {
  try {
    const res = await fetch(`${KV_BASE}/${encodeURIComponent('bot-channels')}`, { headers: KV_HEADERS });
    if (!res.ok) return null;
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

export default {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Setup channel otomatis untuk bot (admin & publik)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const guild = interaction.guild;
    const existing = await getBotChannels();

    if (existing?.adminChannelId && existing?.publicChannelId) {
      const adminCh = guild.channels.cache.get(existing.adminChannelId);
      const publicCh = guild.channels.cache.get(existing.publicChannelId);
      if (adminCh && publicCh) {
        return interaction.editReply({
          embeds: [errorEmbed('Sudah Setup', `Channel udah ada:\n**Admin:** <#${adminCh.id}>\n**Publik:** <#${publicCh.id}>\n\nHapus channel-nya dulu kalo mau setup ulang.`)],
        });
      }
    }

    try {
      const category = await guild.channels.create({
        name: '🤖 Dermist',
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
          {
            id: guild.id,
            allow: [PermissionFlagsBits.ViewChannel],
          },
        ],
      });

      const adminChannel = await guild.channels.create({
        name: 'admin-dermist',
        type: ChannelType.GuildText,
        parent: category.id,
        topic: 'Channel private untuk admin & bot. Laporan moderasi & perintah admin.',
        permissionOverwrites: [
          {
            id: guild.id,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: config.clientId,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ReadMessageHistory],
          },
          {
            id: interaction.user.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
          },
        ],
      });

      const publicChannel = await guild.channels.create({
        name: 'chat-dermist',
        type: ChannelType.GuildText,
        parent: category.id,
        topic: 'Chat dengan Dermist! Mention @Dermist atau ketik /ask untuk bertanya.',
        permissionOverwrites: [
          {
            id: guild.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
          },
          {
            id: config.clientId,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ReadMessageHistory],
          },
        ],
      });

      await kvPut('bot-channels', {
        adminChannelId: adminChannel.id,
        publicChannelId: publicChannel.id,
        categoryId: category.id,
        guildId: guild.id,
      });

      await adminChannel.send({
        embeds: [successEmbed('Setup Selesai', `Channel admin dibuat. Dermist akan posting laporan moderasi & keputusan AI di sini.\n\n**Yang bisa lihat channel ini:** Admin & bot.\n**Channel publik:** <#${publicChannel.id}>`)],
      });

      await publicChannel.send({
        embeds: [successEmbed('Halo Semua! 👋', `Aku **Dermist**, asisten AI server ini!\n\nCara ngobrol sama aku:\n- **Mention** <@${config.clientId}> dengan pesan kamu\n- Pakai command /ask <pertanyaan>\n- Pakai /translate <teks> <bahasa>\n\nAku juga bisa bantu moderasi, kelola channel, dan inget info tentang kalian. Jangan ragu manggil aku ya! 🤖`)],
      });

      log(`Setup selesai: admin=#${adminChannel.name}, publik=#${publicChannel.name}`, 'success');

      await interaction.editReply({
        embeds: [successEmbed('Setup Berhasil!', `Channel dibuat:\n📁 Kategori: **${category.name}**\n🔒 Admin: <#${adminChannel.id}>\n💬 Publik: <#${publicChannel.id}>\n\nBot sekarang tau channel mana untuk admin & member.`)],
      });
    } catch (err) {
      log(`Setup error: ${err.message}`, 'error');
      await interaction.editReply({
        embeds: [errorEmbed('Setup Gagal', `\`${err.message}\`\n\nPastikan bot punya permission "Manage Channels" & "Manage Roles".`)],
      });
    }
  },
};
