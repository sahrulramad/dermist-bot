const TOXIC_PATTERNS = [
  /\b(kontol|memek|anjing|bangsat|bajingan|goblok|goblog|bego|tolol|idiot|setan|iblis|pepek|jembut|ngentot|ngentod|fuck|shit|bitch|asshole|dick|pussy|bastard)\b/i,
  /CAPS.{20,}/,
  /(.)\1{10,}/,
];

const SLUR_PATTERNS = [
  /\b(nigger|nigga|faggot|retard|tranny|chink|spic|kike)\b/i,
];

export function isToxic(text) {
  if (!text || typeof text !== 'string') return false;
  for (const re of TOXIC_PATTERNS) {
    if (re.test(text)) return true;
  }
  return false;
}

export function isSlur(text) {
  if (!text || typeof text !== 'string') return false;
  for (const re of SLUR_PATTERNS) {
    if (re.test(text)) return true;
  }
  return false;
}

export function getToxicReason(text) {
  if (isSlur(text)) return 'slur/hate speech';
  if (/(.)\1{10,}/.test(text)) return 'spam karakter berlebihan';
  if (/CAPS.{20,}/.test(text) || (text === text.toUpperCase() && text.length > 20)) return 'caps lock berlebihan';
  return 'bahasa kasar/toxic';
}
