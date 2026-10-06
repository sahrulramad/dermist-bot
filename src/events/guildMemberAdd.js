import { Events } from 'discord.js';
import { config } from '../config.js';
import { welcomeEmbed } from '../utils/embeds.js';
import { sendLog, log } from '../utils/logger.js';
import { trackJoin, executeLockdown, buildRaidEmbed } from '../utils/anti-raid.js';

export default {
  name: Events.GuildMemberAdd,
  async execute(member) {
    log(`Member join: ${member.user.tag} di ${member.guild.name}`, 'info');

    // ─── Anti-Raid Detection ───
    const raidInfo = trackJoin(member.guild.id, member);
    if (raidInfo.isRaid) {
      log(`🚨 Raid terdeteksi di ${member.guild.name}! Mengaktifkan lockdown...`, 'error');
      const lockdownResult = await executeLockdown(member.guild, raidInfo);

      const targetChannel =
        (config.logChannelId && member.guild.channels.cache.get(config.logChannelId)) ||
        member.guild.systemChannel;

      if (targetChannel) {
        await targetChannel.send({ embeds: [buildRaidEmbed(raidInfo, lockdownResult)] }).catch(() => {});
      }
      return;
    }

    // Auto role & Welcome fallback dari KV jika tidak diset di .env
    let autoRoleId = config.autoRoleId;
    let welcomeChannelId = config.welcomeChannelId;

    if (!autoRoleId || !welcomeChannelId) {
      try {
        const { kvGet } = await import('../utils/memory.js');
        const botChannels = await kvGet('bot-channels');
        if (botChannels) {
          if (!autoRoleId) autoRoleId = botChannels.autoRoleId;
          if (!welcomeChannelId) welcomeChannelId = botChannels.welcomeChannelId;
        }
      } catch {
        /* ignore */
      }
    }

    // Auto role
    if (autoRoleId) {
      const role = member.guild.roles.cache.get(autoRoleId);
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
    if (welcomeChannelId) {
      const channel = member.guild.channels.cache.get(welcomeChannelId);
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
