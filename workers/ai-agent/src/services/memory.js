/**
 * KV Memory Service — akses Cloudflare KV via native binding
 * Menggantikan REST API calls di memory.js
 */

import { KV_KEYS } from '../../../../shared/constants.js';

// ─── Generic KV Operations ───
async function kvGet(kv, key) {
  try {
    const value = await kv.get(key, 'json');
    return value;
  } catch {
    return null;
  }
}

async function kvPut(kv, key, value, options = {}) {
  try {
    await kv.put(key, JSON.stringify(value), options);
    return true;
  } catch (err) {
    console.error(`[KV Put Error] ${key}: ${err.message}`);
    return false;
  }
}

async function kvDelete(kv, key) {
  try {
    await kv.delete(key);
  } catch {
    /* ignore */
  }
}

// ─── Warning Management ───
export async function getWarnings(kv, userId) {
  const data = await kvGet(kv, `${KV_KEYS.WARNINGS}${userId}`);
  return Array.isArray(data) ? data : [];
}

export async function addWarning(kv, userId, warning) {
  const warnings = await getWarnings(kv, userId);
  warnings.push(warning);
  await kvPut(kv, `${KV_KEYS.WARNINGS}${userId}`, warnings);
  return warnings;
}

export async function getActiveWarningCount(kv, userId, decayDays = 30) {
  const warnings = await getWarnings(kv, userId);
  const cutoff = Date.now() - decayDays * 24 * 60 * 60 * 1000;
  return warnings.filter((w) => w.createdAt > cutoff && !w.expired).length;
}

// ─── Facts Management ───
export async function getFacts(kv, userId) {
  const data = await kvGet(kv, `${KV_KEYS.FACTS}${userId}`);
  return Array.isArray(data) ? data : [];
}

export async function addFact(kv, userId, userName, fact) {
  const facts = await getFacts(kv, userId);
  if (facts.some((f) => f.text === fact)) return false;
  facts.push({ text: fact, by: userName, at: Date.now() });
  await kvPut(kv, `${KV_KEYS.FACTS}${userId}`, facts);
  return true;
}

// ─── History Management ───
export async function getHistory(kv, userId) {
  const data = await kvGet(kv, `${KV_KEYS.HISTORY}${userId}`);
  return Array.isArray(data) ? data : [];
}

export async function addHistory(kv, userId, role, content) {
  const arr = await getHistory(kv, userId);
  arr.push({ role, content: content.slice(0, 2000), at: Date.now() });
  if (arr.length > 20) arr.shift();
  await kvPut(kv, `${KV_KEYS.HISTORY}${userId}`, arr);
}

// ─── Daily Stats ───
export async function getDailyStats(kv, guildId, date = null) {
  const d = date || new Date().toISOString().split('T')[0];
  return await kvGet(kv, `${KV_KEYS.DAILY_STATS}${guildId}:${d}`);
}

export async function updateDailyStats(kv, guildId, updater) {
  const date = new Date().toISOString().split('T')[0];
  const key = `${KV_KEYS.DAILY_STATS}${guildId}:${date}`;
  let stats = await kvGet(kv, key);

  if (!stats) {
    const { createDailyStats } = await import('../../../../shared/schemas.js');
    stats = createDailyStats(guildId);
  }

  updater(stats);
  await kvPut(kv, key, stats);
  return stats;
}

// ─── Server Config ───
export async function getServerConfig(kv, guildId) {
  return await kvGet(kv, `${KV_KEYS.SERVER_CONFIG}${guildId}`);
}

export async function setServerConfig(kv, guildId, config) {
  await kvPut(kv, `${KV_KEYS.SERVER_CONFIG}${guildId}`, config);
}

// ─── Raid State ───
export async function getRaidState(kv, guildId) {
  return await kvGet(kv, `${KV_KEYS.RAID_STATE}${guildId}`);
}

export async function setRaidState(kv, guildId, state) {
  // Auto-expire setelah 10 menit
  await kvPut(kv, `${KV_KEYS.RAID_STATE}${guildId}`, state, { expirationTtl: 600 });
}

// ─── Cron Last Run ───
export async function getLastRun(kv, jobName) {
  return await kvGet(kv, `${KV_KEYS.CRON_LAST_RUN}${jobName}`);
}

export async function setLastRun(kv, jobName) {
  await kvPut(kv, `${KV_KEYS.CRON_LAST_RUN}${jobName}`, { timestamp: Date.now() });
}
