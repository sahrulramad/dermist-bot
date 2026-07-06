import { Events } from 'discord.js';
import { config } from '../config.js';
import { goodbyeEmbed } from '../utils/embeds.js';
import { sendLog, log } from '../utils/logger.js';

export default {
  name: Events.GuildMemberRemove,
  async execute(member) {
    log(`Member leave: ${member.user.tag} dari ${member.guild.name}`, 'info');

    // Goodbye message
    if (config.welcomeChannelId) {
      const channel = member.guild.channels.cache.get(config.welcomeChannelId);
      if (channel) {
        try {
          await channel.send({ embeds: [goodbyeEmbed(member)] });
        } catch (err) {
          log(`Gagal kirim goodbye: ${err.message}`, 'error');
        }
      }
    }

    // Log
    await sendLog(member.guild, {
      title: '👤 Member Leave',
      description: `${member.user.tag} (<@${member.id}>) keluar dari server.`,
      color: 0xed4245,
      user: member.user,
      fields: member.joinedTimestamp
        ? [{ name: 'Join Server', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true }]
        : [],
    });
  },
};
