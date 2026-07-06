import { Events } from 'discord.js';
import { config } from '../config.js';
import { welcomeEmbed } from '../utils/embeds.js';
import { sendLog, log } from '../utils/logger.js';

export default {
  name: Events.GuildMemberAdd,
  async execute(member) {
    log(`Member join: ${member.user.tag} di ${member.guild.name}`, 'info');

    // Auto role
    if (config.autoRoleId) {
      const role = member.guild.roles.cache.get(config.autoRoleId);
      if (role) {
        try {
          await member.roles.add(role);
          log(`Auto role diberikan ke ${member.user.tag}`, 'success');
        } catch (err) {
          log(`Gagal beri auto role: ${err.message}`, 'error');
        }
      }
    }

    // Welcome message
    if (config.welcomeChannelId) {
      const channel = member.guild.channels.cache.get(config.welcomeChannelId);
      if (channel) {
        try {
          await channel.send({ content: `<@${member.id}>`, embeds: [welcomeEmbed(member)] });
        } catch (err) {
          log(`Gagal kirim welcome: ${err.message}`, 'error');
        }
      }
    }

    // Log
    await sendLog(member.guild, {
      title: '👤 Member Join',
      description: `${member.user.tag} (<@${member.id}>) bergabung dengan server.`,
      color: 0x57f287,
      user: member.user,
      fields: [
        { name: 'Akun Dibuat', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
      ],
    });
  },
};
