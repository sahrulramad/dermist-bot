import { Events } from 'discord.js';
import { sendLog, log } from '../utils/logger.js';

export default {
  name: Events.MessageDelete,
  async execute(message) {
    if (message.partial || message.author?.bot) return;

    log(`Message deleted di #${message.channel?.name ?? 'unknown'}`, 'info');
    await sendLog(message.guild, {
      title: '🗑️ Message Deleted',
      description: `Pesan dari <@${message.author?.id}> di <#${message.channelId}> dihapus.`,
      color: 0xfee75c,
      user: message.author,
      fields: [
        { name: 'Konten', value: message.content?.slice(0, 1024) || '(kosong / embed)', inline: false },
        { name: 'Channel', value: `<#${message.channelId}>`, inline: true },
      ],
    });
  },
};
