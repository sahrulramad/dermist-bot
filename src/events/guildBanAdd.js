import { Events } from 'discord.js';
import { sendLog, log } from '../utils/logger.js';

export default {
  name: Events.GuildBanAdd,
  async execute(ban) {
    log(`User banned: ${ban.user.tag} di ${ban.guild.name}`, 'warning');
    await sendLog(ban.guild, {
      title: '🔨 Member Banned',
      description: `${ban.user.tag} (<@${ban.user.id}>) telah di-ban.`,
      color: 0xed4245,
      user: ban.user,
    });
  },
};
