import { kvGet } from './memory.js';
import { embed, cosine } from './embeddings.js';
import { log } from './logger.js';

// Cache in-memory untuk index vault agar tidak bolak-balik fetch KV di setiap chat
let cachedIndex = null;
let indexCacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 menit

/**
 * Mengambil metadata sinkronisasi Obsidian Vault dari KV
 */
export async function getVaultMeta() {
  return await kvGet('vault:meta');
}

/**
 * Mengambil index chunk vault (dengan in-memory caching)
 */
export async function getVaultIndex(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedIndex && now - indexCacheTime < CACHE_TTL_MS) {
    return cachedIndex;
  }

  try {
    const index = await kvGet('vault:index');
    if (Array.isArray(index)) {
      cachedIndex = index;
      indexCacheTime = now;
      return cachedIndex;
    }
  } catch (err) {
    log(`Gagal mengambil vault:index dari KV: ${err.message}`, 'error');
  }

  return cachedIndex || [];
}

/**
 * Mencari chunk catatan paling relevan dari Obsidian Vault berdasarkan query
 */
export async function searchVault(query, topK = 3, minScore = 0.2) {
  if (!query || typeof query !== 'string' || query.trim().length < 3) {
    return [];
  }

  const index = await getVaultIndex();
  if (!index || !index.length) {
    return [];
  }

  const qv = embed(query);
  const qLower = query.toLowerCase();
  const qWords = qLower.split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3);

  const scored = [];

  for (const item of index) {
    let score = 0;
    if (item.vector && Array.isArray(item.vector)) {
      score = cosine(qv, item.vector);
    } else {
      // Fallback embed text preview
      score = cosine(qv, embed(`${item.title} ${item.heading} ${item.preview}`));
    }

    // Keyword boost: jika ada kata yang cocok persis di judul atau heading
    const titleLower = (item.title || '').toLowerCase();
    const headingLower = (item.heading || '').toLowerCase();
    const tagsLower = (item.tags || []).join(' ').toLowerCase();

    for (const w of qWords) {
      if (titleLower.includes(w)) score += 0.15;
      if (headingLower.includes(w)) score += 0.12;
      if (tagsLower.includes(w)) score += 0.1;
    }

    if (score >= minScore) {
      scored.push({ item, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  const topMatches = scored.slice(0, topK);

  // Ambil konten lengkap dari masing-masing chunk
  const results = await Promise.all(
    topMatches.map(async ({ item, score }) => {
      const fullChunk = await kvGet(`vault:chunk:${item.id}`);
      return {
        id: item.id,
        file: item.file,
        title: item.title,
        heading: item.heading,
        tags: item.tags || [],
        content: fullChunk?.content || item.preview,
        score,
      };
    })
  );

  return results;
}

/**
 * Membangun blok <vault_knowledge> untuk disuntikkan ke prompt AI
 */
export async function vaultBlock(query) {
  try {
    const results = await searchVault(query, 2, 0.25);
    if (!results.length) return '';

    let block = '\n\n<vault_knowledge>\n[Informasi Faktual dari Catatan Obsidian Server]:';
    for (const res of results) {
      block += `\n--- Dokumen: ${res.title} > ${res.heading} (File: ${res.file}) ---`;
      block += `\n${res.content.trim()}`;
    }
    block += '\n</vault_knowledge>';
    return block;
  } catch (err) {
    log(`Vault block error: ${err.message}`, 'warning');
    return '';
  }
}
