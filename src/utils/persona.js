import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { log } from './logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PERSONA_PATH = path.join(__dirname, '..', 'persona', 'persona.md');

let _cache = { mtime: 0, content: '' };

function readPersona() {
  try {
    const stat = fs.statSync(PERSONA_PATH);
    if (stat.mtimeMs !== _cache.mtime) {
      _cache.content = fs.readFileSync(PERSONA_PATH, 'utf8').trim();
      _cache.mtime = stat.mtimeMs;
      log(`Persona dimuat ulang (mtime: ${stat.mtimeMs})`, 'info');
    }
  } catch {
    _cache.content = 'Kamu adalah Dermist, asisten AI ramah di server Discord.';
  }
  return _cache.content;
}

export function getPersonaBlock() {
  const content = readPersona();
  return `\n\n<persona>\n${content}\n</persona>`;
}
