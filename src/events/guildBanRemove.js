import { Events } from 'discord.js';
import { sendLog, log } from '../utils/logger.js';

export default {
  name: Events.GuildBanRemove,
  async execute(ban) {
    log(`User unbanned: ${ban.user.tag} di ${ban.guild.name}`, 'info');
    await sendLog(ban.guild, {
      title: '🔨 Member Unbanned',
      description: `${ban.user.tag} (<@${ban.user.id}>) ban-nya dicabut.`,
      color: 0x57f287,
      user: ban.user,
    });
  },
};
