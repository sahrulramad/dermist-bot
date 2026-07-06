import { Events } from 'discord.js';
import { runAgent, executePendingAction, hasPendingAction } from '../utils/agent.js';
import { isInjection, FALLBACK_REPLY } from '../utils/guards.js';
import { getPersonaBlock } from '../utils/persona.js';
import { getSkillsBlock } from '../utils/skills.js';
import { factsBlock, addHistory, getHistory, shouldExtract, resetTurnCount, addFact } from '../utils/memory.js';
import { trackMessage, isSpamming, getSpamCount } from '../utils/spam-detect.js';
import { isToxic, isSlur, getToxicReason } from '../utils/toxic-detect.js';
import { extractFacts } from '../utils/cloudflare-ai.js';
import { notifyAutoDetect, notifyAdmin } from '../utils/notifier.js';
import { trackPhotoMessage, getPhotoSpamInfo, hasBeenWarned, markWarned, resetUser as resetPhotoUser } from '../utils/photo-spam-detect.js';
import { log } from '../utils/logger.js';

async function buildServerContext(guild) {
  await guild.members.fetch({ withPresences: true });
  const onlineMembers = guild.members.cache.filter((m) => !m.user.bot && m.presence?.status && m.presence.status !== 'offline');
  const offlineCount = guild.memberCount - onlineMembers.size - guild.members.cache.filter((m) => m.user.bot).size;

  const memberLines = onlineMembers.map((m) => {
    const status = m.presence?.status ?? 'unknown';
    const activities = m.presence?.activities?.filter((a) => a.type === 0).map((a) => a.name).filter(Boolean);
    const activityStr = activities?.length ? ` (lagi main: ${activities.join(', ')})` : '';
    const role = m.id === guild.ownerId ? ' [Owner]' : '';
    return `- ${m.user.username} (ID:${m.id})${role} [${status}]${activityStr}`;
  });

  const botLines = guild.members.cache.filter((m) => m.user.bot).map((m) => `- ${m.user.username} [Bot]`);

  let context = `Nama server: ${guild.name}\nTotal member: ${guild.memberCount}\n`;
  context += `Member online (${onlineMembers.size}):\n${memberLines.join('\n') || '- (tidak ada)'}`;
  if (botLines.length) context += `\nBot:\n${botLines.join('\n')}`;
  context += `\nMember offline: ${offlineCount}`;
  return context;
}

async function handleAgentMessage(message, triggerReason) {
  const userId = message.author.id;
  const userName = message.author.username;
  const content = message.content.replace(/<@!?\d+>/g, '').trim() || message.content;

  try {
    await message.channel.sendTyping();

    const serverContext = await buildServerContext(message.guild);
    const persona = getPersonaBlock();
    const skills = getSkillsBlock(content);
    const facts = await factsBlock(userId, content);
    const history = await getHistory(userId);
    const server = `\n\n<data_server>\n${serverContext}\n</data_server>`;

    const triggerInfo = triggerReason ? `\n\n<context_trigger>\n${triggerReason}\n</context_trigger>` : '';
    const userMsg = triggerReason ? `${content}\n\n[Trigger: ${triggerReason}]` : content;

    const ctx = { guild: message.guild, channel: message.channel, message, chatId: message.channelId };
    const { reply } = await runAgent(userMsg, userName, { persona, skills, facts, server: server + triggerInfo, history }, ctx);

    await addHistory(userId, 'user', content);
    await addHistory(userId, 'assistant', reply);

    const truncated = reply.length > 1900 ? reply.slice(0, 1900) + '...' : reply;
    await message.reply({ content: truncated, allowedMentions: { users: [] } });

    if (await shouldExtract(userId, 5)) {
      log(`Ekstrak fakta untuk ${userName}`, 'info');
      const recentHistory = await getHistory(userId);
      const convo = recentHistory.map((h) => `${h.role}: ${h.content}`).join('\n');
      try {
        const newFacts = await extractFacts(convo, userName);
        let added = 0;
        for (const f of newFacts) {
          if (await addFact(userId, userName, f)) added++;
        }
        if (added) log(`${added} fakta disimpan untuk ${userName}`, 'success');
        await resetTurnCount(userId);
      } catch (err) {
        log(`Gagal ekstrak fakta: ${err.message}`, 'error');
        await resetTurnCount(userId);
      }
    }
  } catch (err) {
    log(`Agent error: ${err.message}`, 'error');
    await message.reply(FALLBACK_REPLY).catch(() => {});
  }
}

export default {
  name: Events.MessageCreate,
  async execute(message) {
    if (message.author.bot) return;

    const userId = message.author.id;
    const chatId = message.channelId;
    const rawContent = message.content;

    trackMessage(userId);

    if (hasPendingAction(chatId)) {
      const lower = rawContent.toLowerCase().trim();
      if (lower === 'ya' || lower === 'yes' || lower === 'yakin' || lower === 'confirm' || lower === 'iya') {
        const ctx = { guild: message.guild, channel: message.channel, message, chatId };
        const result = await executePendingAction(chatId, ctx);
        if (result) await message.reply(result);
        return;
      }
      if (lower === 'tidak' || lower === 'no' || lower === 'batal' || lower === 'cancel') {
        await message.reply('Oke, aksi dibatalkan. ✅');
        return;
      }
    }

    const mentioned = message.mentions.has(message.client.user.id);

    const hasImages = message.attachments.some((a) => a.contentType?.startsWith('image/'));
    if (hasImages) {
      trackPhotoMessage(userId, chatId);
      const spamInfo = getPhotoSpamInfo(userId);

      if (spamInfo.isSpamming) {
        log(`Photo spam dari ${message.author.tag} — ${spamInfo.channels} channel`, 'warning');
        await notifyAutoDetect(message.guild, 'photo-spam', message.author.username, `Foto ke ${spamInfo.channels} channel berbeda dalam 60 detik. Channel: ${spamInfo.channelIds.map((c) => `<#${c}>`).join(', ')}`);

        const member = message.member;
        if (!hasBeenWarned(userId)) {
          markWarned(userId);
          try {
            await message.author.send(`⚠️ **PERINGATAN FOTO SPAM**\n\nKamu terdeteksi mengirim foto ke ${spamInfo.channels} channel berbeda dalam waktu singkat di server **${message.guild.name}**.\n\nIni melanggar aturan. **Pengulangan berikutnya = KICK otomatis.**\n\nTolong kirim foto hanya di channel yang relevan. Terima kasih! 🙏`);
          } catch { /* DM closed */ }
          try { await message.delete(); } catch { /* ignore */ }
          await message.channel.send(`⚠️ <@${userId}>, tolong jangan spam foto ke banyak channel! Peringatan terakhir.`).then((m) => setTimeout(() => m.delete().catch(() => {}), 5000));
          return;
        } else {
          if (member && member.kickable) {
            try {
              await message.author.send(`🚫 Kamu di-**KICK** dari **${message.guild.name}** karena spam foto ke ${spamInfo.channels} channel setelah peringatan.`);
            } catch { /* DM closed */ }
            await member.kick('Spam foto ke banyak channel setelah peringatan');
            log(`Photo spammer dikick: ${message.author.tag}`, 'success');
            await notifyAdmin(message.guild, {
              title: '🚨 [ADMIN] FOTO SPAMMER DIKICK',
              description: `User dikick karena spam foto`,
              color: 0xed4245,
              fields: [
                { name: '👤 User', value: `${message.author.tag} (<@${userId}>)`, inline: true },
                { name: '📸 Channel di-spam', value: spamInfo.channelIds.map((c) => `<#${c}>`).join('\n'), inline: false },
                { name: '⚖️ Aksi', value: 'KICK', inline: true },
                { name: '📝 Alasan', value: 'Spam foto ke banyak channel setelah peringatan', inline: false },
              ],
            });
            resetPhotoUser(userId);
          }
          return;
        }
      }
    }

    if (mentioned) {
      const content = rawContent.replace(/<@!?\d+>/g, '').trim();
      if (!content) {
        await message.reply('Halo! Ada yang bisa aku bantu? Mention aku kalo butuh sesuatu. 🤖');
        return;
      }
      if (isInjection(content)) {
        log(`Injection diblokir dari ${message.author.tag}`, 'warning');
        await message.reply('Aku gak bisa ikuti instruksi itu. 😊');
        return;
      }
      await handleAgentMessage(message, null);
      return;
    }

    if (isSlur(rawContent)) {
      log(`Slur terdeteksi dari ${message.author.tag}`, 'warning');
      await notifyAutoDetect(message.guild, 'slur', message.author.username, `Pesan: "${rawContent.slice(0, 200)}"`);
      try {
        await message.author.send(`🚫 **PERINGATAN: HATE SPEECH**\n\nHai ${message.author.username}, pesan kamu di server **${message.guild.name}** terdeteksi mengandung bahasa yang tidak pantas (hate speech).\n\n**Pesan kamu:** "${rawContent.slice(0, 200)}"\n\nMohon jaga perkataan. Pelanggaran berulang akan berakibat mute atau ban. Terima kasih. 🙏`);
      } catch { /* DM closed */ }
      await handleAgentMessage(message, `User ${message.author.username} terdeteksi menggunakan slur/hate speech. Tindakan disarankan: mute atau warn. Pesan: "${rawContent.slice(0, 100)}"`);
      return;
    }

    if (isSpamming(userId)) {
      const count = getSpamCount(userId);
      log(`Spam terdeteksi dari ${message.author.tag} (${count} pesan cepat)`, 'warning');
      await notifyAutoDetect(message.guild, 'spam', message.author.username, `${count} pesan dalam 10 detik. Pesan terakhir: "${rawContent.slice(0, 200)}"`);
      await handleAgentMessage(message, `User ${message.author.username} terdeteksi spam (${count} pesan dalam 10 detik). Tindakan disarankan: mute 5-10 menit. Pesan terakhir: "${rawContent.slice(0, 100)}"`);
      return;
    }

    if (isToxic(rawContent)) {
      const reason = getToxicReason(rawContent);
      log(`Toxic terdeteksi dari ${message.author.tag}: ${reason}`, 'warning');
      await notifyAutoDetect(message.guild, 'toxic', message.author.username, `Tipe: ${reason}. Pesan: "${rawContent.slice(0, 200)}"`);
      try {
        await message.author.send(`⚠️ **PERINGATAN: BAHASA TIDAK PANTAS**\n\nHai ${message.author.username}, pesan kamu di server **${message.guild.name}** terdeteksi menggunakan bahasa yang kurang pantas (${reason}).\n\n**Pesan kamu:** "${rawContent.slice(0, 200)}"\n\nTolong jaga tutur kata di server. Kalau berulang, kamu bisa kena mute atau kick. Makasih ya! 😊`);
      } catch { /* DM closed */ }
      await handleAgentMessage(message, `User ${message.author.username} terdeteksi pesan toxic (${reason}). Tindakan disarankan: warn. Pesan: "${rawContent.slice(0, 100)}"`);
      return;
    }
  },
};
