/**
 * Shared constants for Dermist Bot & Workers
 * Digunakan di bot (discord.js) dan Cloudflare Workers
 */

// ─── AI Models ───
export const TEXT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
export const EMBED_MODEL = '@cf/baai/bge-base-en-v1.5';

// ─── Embed Colors ───
export const COLORS = {
  success: 0x57f287,
  error: 0xed4245,
  warning: 0xfee75c,
  info: 0x5865f2,
  brand: 0x5865f2,
  dark: 0x2b2d31,
};

// ─── Severity Levels ───
export const SEVERITY = {
  LOW: 'RINGAN',
  MEDIUM: 'SEDANG',
  HIGH: 'BERAT',
  CRITICAL: 'KRITIS',
};

// ─── Warning Escalation Thresholds ───
export const ESCALATION = {
  WARN_TO_MUTE: 3,        // 3 warn → auto mute 30 menit
  WARN_TO_KICK: 5,        // 5 warn → auto kick
  WARN_TO_BAN: 7,          // 7 warn → auto ban
  MUTE_DURATION_MS: 30 * 60 * 1000, // 30 menit
  WARN_DECAY_DAYS: 30,    // Warn kadaluarsa setelah 30 hari
};

// ─── Anti-Raid Thresholds ───
export const RAID = {
  JOIN_WINDOW_MS: 10_000,   // 10 detik window
  JOIN_THRESHOLD: 5,         // 5 join dalam window = raid
  LOCKDOWN_DURATION_MS: 5 * 60 * 1000, // 5 menit lockdown
  ACCOUNT_AGE_THRESHOLD_MS: 7 * 24 * 60 * 60 * 1000, // 7 hari
};

// ─── Rate Limits ───
export const RATE_LIMITS = {
  AI_REQUESTS_PER_MIN: 30,
  TOOLS_PER_MIN: 10,
};

// ─── KV Key Prefixes ───
export const KV_KEYS = {
  FACTS: 'facts:',
  TURNS: 'turns:',
  HISTORY: 'history:',
  WARNINGS: 'warnings:',
  BOT_CHANNELS: 'bot-channels',
  RAID_STATE: 'raid-state',
  DAILY_STATS: 'daily-stats:',
  SERVER_CONFIG: 'server-config:',
  CRON_LAST_RUN: 'cron-last-run:',
};

// ─── Discord Bot REST API Base ───
export const DISCORD_API_BASE = 'https://discord.com/api/v10';
