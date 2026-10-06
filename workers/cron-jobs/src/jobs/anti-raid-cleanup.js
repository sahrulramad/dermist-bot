/**
 * Anti-Raid Cleanup Job
 * 
 * Setiap 5 menit, bersihkan state raid yang sudah expired.
 * Juga bisa digunakan untuk reset lockdown yang terlupakan.
 */

import { KV_KEYS, RAID, DISCORD_API_BASE } from '../../../../shared/constants.js';

export async function antiRaidCleanup(env) {
  const kv = env.KV;
  const guildId = env.DISCORD_GUILD_ID;
  const botToken = env.DISCORD_BOT_TOKEN;

  if (!guildId) return;

  // Cek raid state
  const raidState = await kv.get(`${KV_KEYS.RAID_STATE}${guildId}`, 'json');
  if (!raidState) return;

  const now = Date.now();

  // Jika lockdown sudah lewat durasi, buka kembali
  if (raidState.lockdown && raidState.lockdownStart) {
    const elapsed = now - raidState.lockdownStart;
    if (elapsed >= RAID.LOCKDOWN_DURATION_MS) {
      console.log('[ANTI-RAID] Lockdown expired, membuka kembali server');

      // Buka verification level kembali ke default
      if (botToken) {
        try {
          await fetch(`${DISCORD_API_BASE}/guilds/${guildId}`, {
            method: 'PATCH',
            headers: {
              Authorization: `Bot ${botToken}`,
              'Content-Type': 'application/json',
              'X-Audit-Log-Reason': 'Auto-unlock: Raid lockdown expired',
            },
            body: JSON.stringify({
              verification_level: raidState.previousVerificationLevel ?? 1,
            }),
          });

          console.log('[ANTI-RAID] Server verification level restored');
        } catch (err) {
          console.error('[ANTI-RAID] Gagal restore verification level:', err.message);
        }
      }

      // Reset raid state
      await kv.delete(`${KV_KEYS.RAID_STATE}${guildId}`);

      // Kirim notifikasi
      const botChannels = await kv.get(KV_KEYS.BOT_CHANNELS, 'json');
      if (botChannels?.adminChannelId && botToken) {
        const embed = {
          color: 0x57f287,
          title: '🛡️ Lockdown Selesai',
          description: `Server lockdown telah berakhir otomatis.\nVerification level dikembalikan ke normal.\n\nDurasi lockdown: ${Math.round(elapsed / 60000)} menit`,
          footer: { text: '🤖 Dermist Anti-Raid System' },
          timestamp: new Date().toISOString(),
        };

        await fetch(`${DISCORD_API_BASE}/channels/${botChannels.adminChannelId}/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bot ${botToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ embeds: [embed] }),
        });
      }

      console.log('[ANTI-RAID] Cleanup selesai');
    }
  }
}
