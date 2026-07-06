import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';
import { sendLog } from '../../utils/logger.js';

const warns = new Map();

export default {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Beri peringatan ke member')
    .addUserOption((opt) => opt.setName('member').setDescription('Member yang akan di-warn').setRequired(true))
    .addStringOption((opt) => opt.setName('alasan').setDescription('Alasan warning').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  async execute(interaction) {
    const target = interaction.options.getUser('member');
    const reason = interaction.options.getString('alasan');
    const guildId = interaction.guild.id;

    const key = `${guildId}-${target.id}`;
    const count = (warns.get(key) ?? 0) + 1;
    warns.set(key, count);

    await interaction.reply({
      embeds: [
        successEmbed('Member Diwarn', `${target.tag} telah diberi peringatan.\n**Alasan:** ${reason}\n**Total warn:** ${count}`),
      ],
    });

    await sendLog(interaction.guild, {
      title: '⚠️ Member Warned',
      description: `${target.tag} (<@${target.id}>) diberi peringatan.`,
      color: 0xfee75c,
      user: interaction.user,
      fields: [
        { name: 'Target', value: `${target.tag} (<@${target.id}>)`, inline: true },
        { name: 'Alasan', value: reason, inline: false },
        { name: 'Total Warn', value: `${count}`, inline: true },
      ],
    });

    if (count >= 3) {
      const member = await interaction.guild.members.fetch(target.id).catch(() => null);
      if (member?.moderatable) {
        await member.timeout(3600 * 1000, 'Otomatis: 3+ warning');
        await interaction.followUp({
          embeds: [successEmbed('Auto-Mute', `${target.tag} otomatis di-mute 1 jam karena mencapai 3 warning.`)],
        });
      }
    }
  },
};
