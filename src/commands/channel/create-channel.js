import { SlashCommandBuilder, ChannelType, PermissionFlagsBits } from 'discord.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';
import { sendLog } from '../../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('create-channel')
    .setDescription('Buat channel baru')
    .addStringOption((opt) => opt.setName('nama').setDescription('Nama channel').setRequired(true))
    .addStringOption((opt) =>
      opt.setName('tipe').setDescription('Tipe channel').setRequired(true)
        .addChoices(
          { name: 'Text', value: 'text' },
          { name: 'Voice', value: 'voice' },
          { name: 'Announcement', value: 'announcement' },
          { name: 'Stage', value: 'stage' },
        ),
    )
    .addChannelOption((opt) =>
      opt.setName('kategori').setDescription('Kategori (category) untuk channel').addChannelTypes(ChannelType.GuildCategory).setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  async execute(interaction) {
    const name = interaction.options.getString('nama');
    const type = interaction.options.getString('tipe');
    const category = interaction.options.getChannel('kategori');

    const typeMap = {
      text: ChannelType.GuildText,
      voice: ChannelType.GuildVoice,
      announcement: ChannelType.GuildAnnouncement,
      stage: ChannelType.GuildStageVoice,
    };

    const channel = await interaction.guild.channels.create({
      name,
      type: typeMap[type],
      parent: category?.id ?? undefined,
    });

    await interaction.reply({
      embeds: [successEmbed('Channel Dibuat', `Channel <#${channel.id}> (\`#${channel.name}\`) berhasil dibuat.${category ? `\n**Kategori:** ${category.name}` : ''}`)],
    });

    await sendLog(interaction.guild, {
      title: '📝 Channel Created',
      description: `Channel ${channel.name} dibuat.`,
      color: 0x57f287,
      user: interaction.user,
      fields: [
        { name: 'Nama', value: channel.name, inline: true },
        { name: 'Tipe', value: type, inline: true },
        ...(category ? [{ name: 'Kategori', value: category.name, inline: true }] : []),
      ],
    });
  },
};
