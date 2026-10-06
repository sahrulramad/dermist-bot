import { config } from '../config.js';
import { log } from './logger.js';
import { isSafeFact } from './guards.js';
import { embed, cosine } from './embeddings.js';

const KV_BASE = `https://api.cloudflare.com/client/v4/accounts/${config.cfAccountId}/storage/kv/namespaces/${config.cfKvNamespaceId}/values`;
const KV_HEADERS = { Authorization: `Bearer ${config.cfKvToken || config.cfApiToken}` };

export async function kvGet(key) {
  try {
    const res = await fetch(`${KV_BASE}/${encodeURIComponent(key)}`, { headers: KV_HEADERS });
    if (!res.ok) return null;
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

export async function kvPut(key, value) {
  try {
    await fetch(`${KV_BASE}/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: { ...KV_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify(value),
    });
    return true;
  } catch (err) {
    log(`KV put error (${key}): ${err.message}`, 'error');
    return false;
  }
}

export async function kvDelete(key) {
  try {
    await fetch(`${KV_BASE}/${encodeURIComponent(key)}`, { method: 'DELETE', headers: KV_HEADERS });
    return true;
  } catch {
    return false;
  }
}

// ─── Key Helpers ───
function factKey(userId) { return `facts:${userId}`; }
function turnsKey(userId) { return `turns:${userId}`; }
function historyKey(userId) { return `history:${userId}`; }
function memoKey(guildId, userId) { return `memo:${guildId || 'global'}:${userId}`; }
function serverMemoKey(guildId) { return `memo:${guildId || 'global'}:global`; }
function notesKey(guildId, targetUserId) { return `notes:${guildId || 'global'}:${targetUserId}`; }

function generateId() {
  return Math.random().toString(36).substring(2, 8);
}

// ─── Facts Management (Legacy & Compatibility) ───
export async function getFacts(userId) {
  const data = await kvGet(factKey(userId));
  return Array.isArray(data) ? data : [];
}

export async function addFact(userId, userName, fact, category = 'general') {
  if (!isSafeFact(fact)) {
    log(`Fact ditolak (unsafe): ${fact.slice(0, 50)}`, 'warning');
    return false;
  }
  const facts = await getFacts(userId);
  if (facts.some((f) => (f.text || f) === fact)) return false;
  
  facts.push({
    id: generateId(),
    text: fact,
    category,
    by: userName,
    at: Date.now(),
  });

  await kvPut(factKey(userId), facts);
  log(`Fact disimpan (KV) untuk ${userName}: ${fact.slice(0, 50)}`, 'success');
  return true;
}

export async function removeFact(userId, factOrId) {
  const facts = await getFacts(userId);
  const filtered = facts.filter((f) => f.text !== factOrId && f.id !== factOrId);
  await kvPut(factKey(userId), filtered);
  return filtered.length < facts.length;
}

export async function factsBlock(userId, query = '') {
  const facts = await getFacts(userId);
  if (!facts.length) return '';

  let selected = facts;
  if (query) {
    const qv = embed(query);
    selected = facts
      .map((f) => ({ fact: f, score: cosine(qv, embed(f.text || String(f))) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map((x) => x.fact);
  }

  const lines = selected.map((f) => `- ${f.text || f}`).join('\n');
  return `\n\n<memory>\nFakta yang kamu ingat tentang user ini:\n${lines}\n</memory>`;
}

// ─── Smart Memo System (Model Memo / Mem0) ───
export async function getMemos(guildId, userId, category = null) {
  const data = await kvGet(memoKey(guildId, userId));
  const list = Array.isArray(data) ? data : [];
  if (category) {
    return list.filter((m) => m.category?.toLowerCase() === category.toLowerCase());
  }
  return list;
}

export async function addMemo(guildId, userId, userName, text, category = 'general') {
  if (!isSafeFact(text)) return false;
  const list = await getMemos(guildId, userId);
  
  // Periksa duplikasi berdasarkan kesamaan teks
  if (list.some((m) => m.text.toLowerCase() === text.toLowerCase())) {
    return false;
  }

  const newMemo = {
    id: generateId(),
    text: text.trim(),
    category: category.toLowerCase().trim(),
    by: userName,
    at: Date.now(),
    updatedAt: Date.now(),
  };

  list.push(newMemo);
  // Simpan maksimal 50 memo per user
  if (list.length > 50) list.shift();
  await kvPut(memoKey(guildId, userId), list);
  return newMemo;
}

export async function removeMemo(guildId, userId, identifier) {
  const list = await getMemos(guildId, userId);
  let removed = null;

  // Jika input adalah index numerik 1-based
  const idx = parseInt(identifier, 10);
  if (!isNaN(idx) && idx >= 1 && idx <= list.length) {
    removed = list.splice(idx - 1, 1)[0];
  } else {
    const targetIdx = list.findIndex((m) => m.id === identifier || m.text.toLowerCase() === identifier.toLowerCase());
    if (targetIdx !== -1) {
      removed = list.splice(targetIdx, 1)[0];
    }
  }

  if (removed) {
    await kvPut(memoKey(guildId, userId), list);
    return removed;
  }
  return null;
}

export async function clearMemos(guildId, userId) {
  return await kvDelete(memoKey(guildId, userId));
}

// ─── Server Global Memos ───
export async function getServerMemos(guildId, category = null) {
  const data = await kvGet(serverMemoKey(guildId));
  const list = Array.isArray(data) ? data : [];
  if (category) {
    return list.filter((m) => m.category?.toLowerCase() === category.toLowerCase());
  }
  return list;
}

export async function addServerMemo(guildId, userName, text, category = 'general') {
  if (!isSafeFact(text)) return false;
  const list = await getServerMemos(guildId);
  
  if (list.some((m) => m.text.toLowerCase() === text.toLowerCase())) {
    return false;
  }

  const memo = {
    id: generateId(),
    text: text.trim(),
    category: category.toLowerCase().trim(),
    by: userName,
    at: Date.now(),
  };

  list.push(memo);
  if (list.length > 50) list.shift();
  await kvPut(serverMemoKey(guildId), list);
  return memo;
}

export async function removeServerMemo(guildId, identifier) {
  const list = await getServerMemos(guildId);
  let removed = null;

  const idx = parseInt(identifier, 10);
  if (!isNaN(idx) && idx >= 1 && idx <= list.length) {
    removed = list.splice(idx - 1, 1)[0];
  } else {
    const targetIdx = list.findIndex((m) => m.id === identifier || m.text.toLowerCase() === identifier.toLowerCase());
    if (targetIdx !== -1) {
      removed = list.splice(targetIdx, 1)[0];
    }
  }

  if (removed) {
    await kvPut(serverMemoKey(guildId), list);
    return removed;
  }
  return null;
}

export async function clearServerMemos(guildId) {
  return await kvDelete(serverMemoKey(guildId));
}

// ─── Admin Member Notes ───
export async function getAdminNotes(guildId, targetUserId) {
  const data = await kvGet(notesKey(guildId, targetUserId));
  return Array.isArray(data) ? data : [];
}

export async function addAdminNote(guildId, targetUserId, authorName, text, type = 'info') {
  const notes = await getAdminNotes(guildId, targetUserId);
  const note = {
    id: generateId(),
    text: text.trim(),
    type, // 'info', 'warning', 'pantau'
    by: authorName,
    at: Date.now(),
  };
  notes.push(note);
  if (notes.length > 30) notes.shift();
  await kvPut(notesKey(guildId, targetUserId), notes);
  return note;
}

export async function clearAdminNotes(guildId, targetUserId) {
  return await kvDelete(notesKey(guildId, targetUserId));
}

// ─── Semantic Memo Block Builder (Untuk Prompt AI) ───
export async function memoBlock(guildId, userId, query = '') {
  const [userMemos, serverMemos, legacyFacts] = await Promise.all([
    getMemos(guildId, userId),
    getServerMemos(guildId),
    getFacts(userId),
  ]);

  if (!userMemos.length && !serverMemos.length && !legacyFacts.length) {
    return '';
  }

  const qv = query ? embed(query) : null;

  // Filter personal memos & facts
  let allPersonal = [
    ...userMemos.map((m) => ({ text: m.text, cat: m.category })),
    ...legacyFacts.map((f) => ({ text: f.text || String(f), cat: f.category || 'fakta' })),
  ];

  if (qv && allPersonal.length > 5) {
    allPersonal = allPersonal
      .map((item) => ({ item, score: cosine(qv, embed(item.text)) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((x) => x.item);
  }

  // Filter server memos
  let selectedServer = serverMemos;
  if (qv && selectedServer.length > 5) {
    selectedServer = selectedServer
      .map((item) => ({ item, score: cosine(qv, embed(item.text)) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((x) => x.item);
  }

  let block = '\n\n<memo_memory>';
  if (allPersonal.length) {
    block += '\n[Ingatan tentang User]:\n';
    block += allPersonal.map((p) => `- [${p.cat || 'info'}] ${p.text}`).join('\n');
  }
  if (selectedServer.length) {
    block += '\n\n[Ingatan tentang Server]:\n';
    block += selectedServer.map((s) => `- [${s.category || 'server'}] ${s.text}`).join('\n');
  }
  block += '\n</memo_memory>';
  return block;
}

// ─── Auto-Extraction & Deduplication (Mem0 Pattern) ───
export async function autoSaveExtractedFacts(userId, userName, extractedFactsList) {
  if (!Array.isArray(extractedFactsList) || !extractedFactsList.length) return 0;
  const existingFacts = await getFacts(userId);
  let savedCount = 0;

  for (const rawFact of extractedFactsList) {
    const factText = rawFact.replace(/^-\s*/, '').trim();
    if (!factText || !isSafeFact(factText)) continue;

    const factVec = embed(factText);

    // Cek apakah ada fakta yang sangat mirip (cosine > 0.82)
    let isDuplicate = false;
    for (const ex of existingFacts) {
      const exText = ex.text || String(ex);
      const exVec = embed(exText);
      const sim = cosine(factVec, exVec);

      if (sim > 0.82) {
        // Mirip sekali -> update text & timestamp (conflict update)
        ex.text = factText;
        ex.updatedAt = Date.now();
        ex.by = userName;
        isDuplicate = true;
        savedCount++;
        break;
      }
    }

    if (!isDuplicate) {
      existingFacts.push({
        id: generateId(),
        text: factText,
        category: 'auto-learned',
        by: userName,
        at: Date.now(),
        updatedAt: Date.now(),
      });
      savedCount++;
    }
  }

  // Batasi fakta maksimal 30 per user
  while (existingFacts.length > 30) {
    existingFacts.shift();
  }

  await kvPut(factKey(userId), existingFacts);
  return savedCount;
}

// ─── History & Turn Counter ───
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
