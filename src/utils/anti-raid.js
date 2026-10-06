/**
 * Anti-Raid Detection — Event-driven di bot
 * 
 * Deteksi burst join dalam waktu singkat → lockdown server
 * Bekerja bersama cron-jobs/anti-raid-cleanup.js yang membuka lockdown
 */

import { EmbedBuilder } from 'discord.js';
import { config } from '../config.js';
import { log } from './logger.js';
import { RAID, KV_KEYS } from '../../shared/constants.js';

// In-memory join tracker (hanya hidup selama bot jalan)
const joinTracker = new Map();

/**
 * Track member join — panggil dari guildMemberAdd event
 * @returns {{ isRaid: boolean, joinCount: number }}
 */
export function trackJoin(guildId, member) {
  const now = Date.now();
  const key = guildId;

  if (!joinTracker.has(key)) {
    joinTracker.set(key, []);
  }

  const joins = joinTracker.get(key);
  joins.push({
    userId: member.id,
    username: member.user.username,
    accountAge: now - member.user.createdTimestamp,
    timestamp: now,
  });

  // Bersihkan yang sudah lewat window
  const windowStart = now - RAID.JOIN_WINDOW_MS;
  const activeJoins = joins.filter((j) => j.timestamp >= windowStart);
  joinTracker.set(key, activeJoins);

  // Cek threshold
  if (activeJoins.length >= RAID.JOIN_THRESHOLD) {
    // Cek berapa yang akun baru (< 7 hari)
    const newAccounts = activeJoins.filter((j) => j.accountAge < RAID.ACCOUNT_AGE_THRESHOLD_MS);
    const suspiciousRatio = newAccounts.length / activeJoins.length;

    return {
      isRaid: true,
      joinCount: activeJoins.length,
      newAccountCount: newAccounts.length,
      suspiciousRatio,
      joins: activeJoins,
    };
  }

  return { isRaid: false, joinCount: activeJoins.length };
}

/**
 * Execute lockdown — tingkatkan verification level dan kick akun baru
 */
export async function executeLockdown(guild, raidInfo) {
  log(`🚨 RAID DETECTED! ${raidInfo.joinCount} joins in ${RAID.JOIN_WINDOW_MS / 1000}s`, 'error');

  try {
    // Simpan state sebelum lockdown
    const previousVerLevel = guild.verificationLevel;

    // Tingkatkan verification level ke HIGHEST
    await guild.setVerificationLevel(4, 'Anti-Raid lockdown');
    log(`Server verification level set to HIGHEST`, 'warning');

    // Kick akun baru yang bergabung saat raid
    let kicked = 0;
    for (const join of raidInfo.joins) {
      if (join.accountAge < RAID.ACCOUNT_AGE_THRESHOLD_MS) {
        try {
          const member = await guild.members.fetch(join.userId).catch(() => null);
          if (member && member.kickable) {
            await member.kick('Anti-Raid: Akun baru terdeteksi saat raid');
            kicked++;
          }
        } catch {
          /* ignore */
        }
      }
    }

    log(`Kicked ${kicked} suspicious accounts during raid`, 'warning');

    // Simpan raid state ke KV untuk cron cleanup
    const kvBase = `https://api.cloudflare.com/client/v4/accounts/${config.cfAccountId}/storage/kv/namespaces/${config.cfKvNamespaceId}/values`;
    const kvHeaders = { Authorization: `Bearer ${config.cfKvToken || config.cfApiToken}`, 'Content-Type': 'application/json' };

    const raidState = {
      lockdown: true,
      lockdownStart: Date.now(),
      previousVerificationLevel: previousVerLevel,
      joinCount: raidInfo.joinCount,
      kicked,
    };

    await fetch(`${kvBase}/${encodeURIComponent(`${KV_KEYS.RAID_STATE}${guild.id}`)}`, {
      method: 'PUT',
      headers: kvHeaders,
      body: JSON.stringify(raidState),
    });

    // Update daily stats
    const today = new Date().toISOString().split('T')[0];
    const statsKey = `${KV_KEYS.DAILY_STATS}${guild.id}:${today}`;
    const statsRes = await fetch(`${kvBase}/${encodeURIComponent(statsKey)}`, { headers: kvHeaders });
    if (statsRes.ok) {
      try {
        const stats = await statsRes.json();
        stats.raidAttempts = (stats.raidAttempts || 0) + 1;
        await fetch(`${kvBase}/${encodeURIComponent(statsKey)}`, {
          method: 'PUT',
          headers: kvHeaders,
          body: JSON.stringify(stats),
        });
      } catch {
        /* ignore parse errors */
      }
    }

    return { previousVerLevel, kicked, raidState };
  } catch (err) {
    log(`Lockdown error: ${err.message}`, 'error');
    return null;
  }
}

/**
 * Buat embed notifikasi raid untuk admin
 */
export function buildRaidEmbed(raidInfo, lockdownResult) {
  return new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle('🚨 RAID DETECTED — SERVER LOCKDOWN')
    .setDescription(`Terdeteksi **${raidInfo.joinCount} member join** dalam ${RAID.JOIN_WINDOW_MS / 1000} detik!`)
    .addFields(
      { name: '👥 Total Join', value: `${raidInfo.joinCount}`, inline: true },
      { name: '🆕 Akun Baru', value: `${raidInfo.newAccountCount}`, inline: true },
      { name: '👢 Dikick', value: `${lockdownResult?.kicked ?? 0}`, inline: true },
      { name: '🔒 Status', value: 'Server di-lockdown (verification level HIGHEST)', inline: false },
      { name: '⏰ Auto-unlock', value: `${RAID.LOCKDOWN_DURATION_MS / 60000} menit`, inline: true },
      {
        name: '📋 Member yang Join',
        value: raidInfo.joins
          .slice(0, 10)
          .map((j) => {
            const isNew = j.accountAge < RAID.ACCOUNT_AGE_THRESHOLD_MS;
            return `${isNew ? '🆕' : '✅'} ${j.username} (<@${j.userId}>)`;
          })
          .join('\n'),
        inline: false,
      },
    )
    .setFooter({ text: '🤖 Dermist Anti-Raid System • Auto-unlock akan diproses oleh Cron Worker' })
    .setTimestamp();
}

/**
 * Reset tracker untuk guild
 */
export function resetJoinTracker(guildId) {
  joinTracker.delete(guildId);
}
