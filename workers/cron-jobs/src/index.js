/**
 * Dermist Cron Jobs Worker — Entry Point
 * 
 * Menjalankan scheduled tasks:
 * - Daily Report (08:00 WIB) — Laporan harian aktivitas server
 * - Warning Escalation (setiap 15 menit) — Auto-escalate warn → mute → kick
 * - Anti-Raid Cleanup (setiap 5 menit) — Bersihkan state raid yang expired
 */

import { dailyReport } from './jobs/daily-report.js';
import { warningEscalation } from './jobs/warning-escalation.js';
import { antiRaidCleanup } from './jobs/anti-raid-cleanup.js';

export default {
  /**
   * Cron trigger handler — Cloudflare memanggil ini sesuai schedule di wrangler.toml
   */
  async scheduled(event, env, ctx) {
    const cron = event.cron;
    console.log(`[CRON] Triggered: ${cron} at ${new Date().toISOString()}`);

    try {
      switch (cron) {
        // Daily Report — 0 1 * * * (08:00 WIB)
        case '0 1 * * *':
          await dailyReport(env);
          break;

        // Warning Escalation — setiap 15 menit
        case '*/15 * * * *':
          await warningEscalation(env);
          break;

        // Anti-Raid Cleanup — setiap 5 menit
        case '*/5 * * * *':
          await antiRaidCleanup(env);
          break;

        default:
          console.warn(`[CRON] Unknown cron: ${cron}`);
      }
    } catch (err) {
      console.error(`[CRON ERROR] ${cron}: ${err.message}`, err.stack);
    }
  },

  /**
   * HTTP handler untuk manual trigger (dev/testing)
   * GET /trigger/:jobName
   */
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/health') {
      return Response.json({
        status: 'ok',
        service: 'dermist-cron-jobs',
        timestamp: new Date().toISOString(),
      });
    }

    // Manual trigger untuk testing
    if (path.startsWith('/trigger/')) {
      const jobName = path.replace('/trigger/', '');

      // Cek auth
      const auth = request.headers.get('Authorization');
      if (env.AUTH_SECRET && auth !== `Bearer ${env.AUTH_SECRET}`) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }

      try {
        switch (jobName) {
          case 'daily-report':
            await dailyReport(env);
            return Response.json({ status: 'ok', job: 'daily-report' });
          case 'warning-escalation':
            await warningEscalation(env);
            return Response.json({ status: 'ok', job: 'warning-escalation' });
          case 'anti-raid-cleanup':
            await antiRaidCleanup(env);
            return Response.json({ status: 'ok', job: 'anti-raid-cleanup' });
          default:
            return Response.json({ error: `Unknown job: ${jobName}` }, { status: 404 });
        }
      } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
      }
    }

    return Response.json({ error: 'Not found' }, { status: 404 });
  },
};
