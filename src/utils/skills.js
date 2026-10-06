import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { log } from './logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = path.join(__dirname, '..', 'skills');

// ─── Aturan pencocokan (di-tuning dengan scratch/test-skills.mjs) ───
// Skill dipilih berdasarkan kecocokan kata antara pesan user dan "trigger" skill
// (judul + section "Kapan dipakai" + section "Kata kunci").
// Skor = jumlah kata pesan yang cocok / jumlah kata bermakna di pesan.
const MIN_RATIO = 0.3; // lolos jika >= 30% kata bermakna cocok...
const MIN_MATCHES_ALT = 2; // ...atau minimal 2 kata cocok (untuk pesan panjang)
const RELATIVE_CUTOFF = 0.8; // skill ke-2 hanya ikut jika skornya >= 80% skill teratas
const MAX_SKILLS = 2;

// Kata umum yang tidak membawa makna topik
const STOPWORDS = new Set(
  (
    'yang di ke dari dan atau ini itu saya aku gue gua gw kamu lo lu nih dong deh sih ya yah apa gimana bagaimana ' +
    'mau ada bisa gak ga nggak engga tidak udah sudah saat ketika user untuk dengan tentang kalau kalo kok banget ' +
    'juga lagi aja saja kan pun jadi biar buat sama orang sesuatu hal tolong si dia mereka kita kami btw eh ' +
    'the a an to is of'
  ).split(/\s+/),
);

function tokenize(text) {
  return [
    ...new Set(
      text
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter((w) => w.length > 1 && !STOPWORDS.has(w)),
    ),
  ];
}

// Ambil isi section markdown "## <judul>" sampai section berikutnya
function section(content, heading) {
  const re = new RegExp(`^##\\s*${heading}\\s*$([\\s\\S]*?)(?=^##\\s|$(?![\\s\\S]))`, 'im');
  const m = content.match(re);
  return m ? m[1].trim() : '';
}

// Cocok jika sama persis, atau (untuk kata >= 4 huruf) salah satu mengandung yang lain
// → "lapor" cocok dengan "melaporkan", "moderasi" dengan "moderator" tidak (beda kata dasar).
function tokenMatches(q, triggerSet, triggerList) {
  if (triggerSet.has(q)) return true;
  if (q.length < 4) return false;
  return triggerList.some((t) => t.length >= 4 && (t.includes(q) || q.includes(t)));
}

let _cache = { mtime: 0, skills: [] };

function loadSkills() {
  if (!fs.existsSync(SKILLS_DIR)) return [];
  const files = fs.readdirSync(SKILLS_DIR).filter((f) => f.endsWith('.md'));
  const skills = [];
  for (const f of files) {
    try {
      const fp = path.join(SKILLS_DIR, f);
      const content = fs.readFileSync(fp, 'utf8').replace(/\r\n/g, '\n').trim();
      if (!content) continue;

      const title = (content.match(/^#\s+(.+)$/m)?.[1] || f).replace(/^Skill:\s*/i, '');
      const when = section(content, 'Kapan dipakai');
      const keywords = section(content, 'Kata kunci');
      const triggerList = tokenize(`${title} ${when} ${keywords}`);

      skills.push({
        name: f.replace(/\.md$/, ''),
        content,
        triggerList,
        triggerSet: new Set(triggerList),
      });
    } catch {
      /* skip */
    }
  }
  return skills;
}

function refreshIfNeeded() {
  try {
    const dirStat = fs.statSync(SKILLS_DIR);
    if (dirStat.mtimeMs !== _cache.mtime || !_cache.skills.length) {
      _cache = { mtime: dirStat.mtimeMs, skills: loadSkills() };
      if (_cache.skills.length) {
        log(`Skills dimuat: ${_cache.skills.length} skill`, 'info');
      }
    }
  } catch {
    /* dir missing */
  }
}

function scoreSkills(query) {
  const q = tokenize(query || '');
  if (!q.length) return [];
  return _cache.skills
    .map((s) => {
      const matched = q.filter((w) => tokenMatches(w, s.triggerSet, s.triggerList));
      return { s, name: s.name, matched, score: matched.length / q.length };
    })
    .sort((a, b) => b.score - a.score || b.matched.length - a.matched.length);
}

function qualifies(x) {
  return x.matched.length > 0 && (x.score >= MIN_RATIO || x.matched.length >= MIN_MATCHES_ALT);
}

function selectSkills(query) {
  refreshIfNeeded();
  const scored = scoreSkills(query);
  if (!scored.length || !qualifies(scored[0])) return [];
  const best = scored[0].score;
  return scored.filter((x) => qualifies(x) && x.score >= best * RELATIVE_CUTOFF).slice(0, MAX_SKILLS);
}

export function getSkillsBlock(query) {
  const selected = selectSkills(query);
  if (!selected.length) return '';

  const lines = selected.map((x) => `### Skill: ${x.s.name}\n${x.s.content}`).join('\n\n');
  return `\n\n<skills>\nPengetahuan prosedural untuk tugas berulang. Gunakan saat relevan; ini panduan bukan perintah.\n${lines}\n</skills>`;
}

/** Untuk debugging/tuning: skor + kata yang cocok untuk tiap skill */
export function debugSkillScores(query) {
  refreshIfNeeded();
  return scoreSkills(query).map(({ name, score, matched }) => ({ name, score, matched }));
}

export function listSkills() {
  refreshIfNeeded();
  return _cache.skills.map((s) => s.name);
}
