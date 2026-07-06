import { EmbedBuilder } from 'discord.js';
import { config } from '../config.js';

export function successEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle(`✅ ${title}`)
    .setDescription(description)
    .setTimestamp();
}

export function errorEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle(`❌ ${title}`)
    .setDescription(description)
    .setTimestamp();
}

export function warningEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(0xfee75c)
    .setTitle(`⚠️ ${title}`)
    .setDescription(description)
    .setTimestamp();
}

export function infoEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(config.embedColor)
    .setTitle(`ℹ️ ${title}`)
    .setDescription(description)
    .setTimestamp();
}

export function welcomeEmbed(member) {
  return new EmbedBuilder()
    .setColor(config.embedColor)
    .setTitle(`👋 Selamat Datang, ${member.user.username}!`)
    .setDescription(`Halo <@${member.id}>, selamat datang di **${member.guild.name}**!\nSemoga betah ya di server kami. 🎉`)
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
    .addFields(
      { name: '👥 Total Member', value: `${member.guild.memberCount}`, inline: true },
      { name: '📅 Akun Dibuat', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
    )
    .setTimestamp();
}

export function goodbyeEmbed(member) {
  return new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle(`👋 Selamat Tinggal, ${member.user.username}`)
    .setDescription(`<@${member.id}> telah keluar dari server.\nSemoga kita berjumpa lagi. 🖤`)
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
    .addFields(
      { name: '👥 Total Member', value: `${member.guild.memberCount}`, inline: true },
      { name: '📅 Join Server', value: member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : 'Tidak diketahui', inline: true },
    )
    .setTimestamp();
}
