const SPAM_WINDOW_MS = 10000;
const SPAM_THRESHOLD = 5;
const userMessages = new Map();

export function trackMessage(userId) {
  const now = Date.now();
  const timestamps = userMessages.get(userId) || [];
  const recent = timestamps.filter((t) => now - t < SPAM_WINDOW_MS);
  recent.push(now);
  userMessages.set(userId, recent);
  return recent;
}

export function isSpamming(userId) {
  const now = Date.now();
  const timestamps = userMessages.get(userId) || [];
  const recent = timestamps.filter((t) => now - t < SPAM_WINDOW_MS);
  return recent.length >= SPAM_THRESHOLD;
}

export function getSpamCount(userId) {
  const now = Date.now();
  const timestamps = userMessages.get(userId) || [];
  return timestamps.filter((t) => now - t < SPAM_WINDOW_MS).length;
}

export function resetUser(userId) {
  userMessages.delete(userId);
}
