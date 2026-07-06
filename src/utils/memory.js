import { config } from '../config.js';
import { log } from './logger.js';
import { isSafeFact } from './guards.js';
import { embed, cosine } from './embeddings.js';

const KV_BASE = `https://api.cloudflare.com/client/v4/accounts/${config.cfAccountId}/storage/kv/namespaces/${config.cfKvNamespaceId}/values`;
const KV_HEADERS = { Authorization: `Bearer ${config.cfKvToken || config.cfApiToken}` };

async function kvGet(key) {
  try {
    const res = await fetch(`${KV_BASE}/${encodeURIComponent(key)}`, { headers: KV_HEADERS });
    if (!res.ok) return null;
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

async function kvPut(key, value) {
  try {
    await fetch(`${KV_BASE}/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: { ...KV_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify(value),
    });
    return true;
  } catch (err) {
    log(`KV put error: ${err.message}`, 'error');
    return false;
  }
}

async function kvDelete(key) {
  try {
    await fetch(`${KV_BASE}/${encodeURIComponent(key)}`, { method: 'DELETE', headers: KV_HEADERS });
  } catch {
    /* ignore */
  }
}

function factKey(userId) { return `facts:${userId}`; }
function turnsKey(userId) { return `turns:${userId}`; }
function historyKey(userId) { return `history:${userId}`; }

export async function getFacts(userId) {
  const data = await kvGet(factKey(userId));
  return Array.isArray(data) ? data : [];
}

export async function addFact(userId, userName, fact) {
  if (!isSafeFact(fact)) {
    log(`Fact ditolak (unsafe): ${fact.slice(0, 50)}`, 'warning');
    return false;
  }
  const facts = await getFacts(userId);
  if (facts.some((f) => f.text === fact)) return false;
  facts.push({ text: fact, by: userName, at: Date.now() });
  await kvPut(factKey(userId), facts);
  log(`Fact disimpan (KV) untuk ${userName}: ${fact.slice(0, 50)}`, 'success');
  return true;
}

export async function removeFact(userId, fact) {
  const facts = await getFacts(userId);
  const filtered = facts.filter((f) => f.text !== fact);
  await kvPut(factKey(userId), filtered);
}

export async function factsBlock(userId, query = '') {
  const facts = await getFacts(userId);
  if (!facts.length) return '';

  let selected = facts;
  if (query) {
    const qv = embed(query);
    selected = facts
      .map((f) => ({ fact: f, score: cosine(qv, embed(f.text)) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 15)
      .map((x) => x.fact);
  }

  const lines = selected.map((f) => `- ${f.text}`).join('\n');
  return `\n\n<memory>\nFakta yang kamu ingat tentang user ini:\n${lines}\n</memory>`;
}

export async function incrementTurn(userId) {
  const count = (await kvGet(turnsKey(userId))) || 0;
  const newCount = count + 1;
  await kvPut(turnsKey(userId), newCount);
  return newCount;
}

export async function shouldExtract(userId, everyN = 5) {
  const count = await incrementTurn(userId);
  return count >= everyN;
}

export async function resetTurnCount(userId) {
  await kvPut(turnsKey(userId), 0);
}

export async function addHistory(userId, role, content) {
  const history = await kvGet(historyKey(userId));
  const arr = Array.isArray(history) ? history : [];
  arr.push({ role, content: content.slice(0, 2000), at: Date.now() });
  if (arr.length > 20) arr.shift();
  await kvPut(historyKey(userId), arr);
}

export async function getHistory(userId) {
  const data = await kvGet(historyKey(userId));
  return Array.isArray(data) ? data : [];
}

export async function clearHistory(userId) {
  await kvDelete(historyKey(userId));
}
