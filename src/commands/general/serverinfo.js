import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { config } from '../../config.js';

export default {
  data: new SlashCommandBuilder().setName('serverinfo').setDescription('Tampilkan informasi server'),
  async execute(interaction) {
    const guild = interaction.guild;
    await guild.members.fetch();

    const embed = new EmbedBuilder()
      .setColor(config.embedColor)
      .setTitle(`📊 Info Server: ${guild.name}`)
      .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }))
      .addFields(
        { name: '🆔 Server ID', value: guild.id, inline: true },
        { name: '👑 Owner', value: `<@${guild.ownerId}>`, inline: true },
        { name: '📅 Dibuat', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
        { name: '👥 Total Member', value: `${guild.memberCount}`, inline: true },
        { name: '🤖 Bot', value: `${guild.members.cache.filter((m) => m.user.bot).size}`, inline: true },
        { name: '👤 Human', value: `${guild.members.cache.filter((m) => !m.user.bot).size}`, inline: true },
        { name: '💬 Channel', value: `${guild.channels.cache.size}`, inline: true },
        { name: '🎭 Role', value: `${guild.roles.cache.size}`, inline: true },
        { name: '😊 Emoji', value: `${guild.emojis.cache.size}`, inline: true },
      )
      .setFooter({ text: `Boost Level ${guild.premiumTier} • ${guild.premiumSubscriptionCount} boost` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
