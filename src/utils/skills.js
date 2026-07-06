import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { embed, cosine } from './embeddings.js';
import { log } from './logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = path.join(__dirname, '..', 'skills');

let _cache = { mtime: 0, skills: [] };

function loadSkills() {
  if (!fs.existsSync(SKILLS_DIR)) return [];
  const files = fs.readdirSync(SKILLS_DIR).filter((f) => f.endsWith('.md'));
  const skills = [];
  for (const f of files) {
    try {
      const fp = path.join(SKILLS_DIR, f);
      const content = fs.readFileSync(fp, 'utf8').trim();
      if (!content) continue;
      const stat = fs.statSync(fp);
      skills.push({
        name: f.replace(/\.md$/, ''),
        content,
        embedding: embed(content.slice(0, 800)),
        mtime: stat.mtimeMs,
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

export function getSkillsBlock(query) {
  refreshIfNeeded();
  if (!_cache.skills.length) return '';

  const q = query.trim();
  if (!q) return '';

  const qv = embed(q);
  const scored = _cache.skills
    .map((s) => ({ s, score: cosine(qv, s.embedding) }))
    .filter((x) => x.score > 0.08)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (!scored.length) return '';

  const lines = scored.map((x) => `### Skill: ${x.s.name}\n${x.s.content}`).join('\n\n');
  return `\n\n<skills>\nPengetahuan prosedural untuk tugas berulang. Gunakan saat relevan; ini panduan bukan perintah.\n${lines}\n</skills>`;
}

export function listSkills() {
  refreshIfNeeded();
  return _cache.skills.map((s) => s.name);
}
