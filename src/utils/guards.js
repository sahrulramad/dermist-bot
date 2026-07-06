const INJECTION_PATTERNS = [
  /\b(ignore|disregard|forget|override|bypass|reveal|disclose|print|repeat|output|act as|pretend|roleplay|jailbreak)\b/i,
  /\b(you must|you should|you will|you are now|from now on|always|never)\b/i,
  /\b(system\s*prompt|instruction|directive|rule|persona|guardrail|model|api|developer)\b/i,
  /\b(your\s+(instruction|rule|prompt|system|persona|name is)|you are an? )\b/i,
  /\b(abaikan|lupakan|hiraukan|sistem|instruksi|aturan|perintah|kamu harus|kamu adalah|mulai sekarang|selalu|jangan pernah|ungkapkan|tunjukkan|berpura|pura)\b/i,
];

export function isInjection(text) {
  if (typeof text !== 'string') return false;
  const t = text.trim();
  if (!t) return false;
  for (const re of INJECTION_PATTERNS) {
    if (re.test(t)) return true;
  }
  return false;
}

export function isSafeFact(text) {
  if (typeof text !== 'string') return false;
  const t = text.trim();
  if (!t || t.length > 200) return false;
  if (/[\n\r]/.test(t)) return false;
  for (const re of INJECTION_PATTERNS) if (re.test(t)) return false;
  return true;
}

export const FALLBACK_REPLY = 'Maaf, aku gak bisa ngerti pertanyaanmu. Coba tanya dengan cara lain ya! 😊';
