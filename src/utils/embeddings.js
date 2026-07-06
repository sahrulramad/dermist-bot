const EMBED_DIM = 256;

function bucket(token) {
  let h = 0x811c9dc5;
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) % EMBED_DIM;
}

function unigrams(text) {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 0);
}

function charTrigrams(word) {
  const padded = `#${word}#`;
  const out = [];
  for (let i = 0; i < padded.length - 2; i++) out.push(padded.slice(i, i + 3));
  return out;
}

export function embed(text) {
  const v = new Float32Array(EMBED_DIM);
  if (!text) return v;

  const words = unigrams(text);
  for (const w of words) {
    v[bucket(w)] += 1;
    if (w.length >= 4) {
      for (const tg of charTrigrams(w)) v[bucket('$' + tg)] += 0.5;
    }
  }

  let norm = 0;
  for (let i = 0; i < EMBED_DIM; i++) norm += v[i] * v[i];
  norm = Math.sqrt(norm);
  if (norm > 0) for (let i = 0; i < EMBED_DIM; i++) v[i] /= norm;
  return v;
}

export function cosine(a, b) {
  if (a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
