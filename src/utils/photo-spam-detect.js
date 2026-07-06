const WINDOW_MS = 60000;
const CHANNEL_THRESHOLD = 3;
const userPhotoLogs = new Map();

export function trackPhotoMessage(userId, channelId) {
  const now = Date.now();
  const logs = userPhotoLogs.get(userId) || [];
  const recent = logs.filter((l) => now - l.at < WINDOW_MS);
  recent.push({ channelId, at: now });
  userPhotoLogs.set(userId, recent);
  return recent;
}

export function getPhotoSpamInfo(userId) {
  const now = Date.now();
  const logs = userPhotoLogs.get(userId) || [];
  const recent = logs.filter((l) => now - l.at < WINDOW_MS);
  const channels = new Set(recent.map((l) => l.channelId));
  return {
    count: recent.length,
    channels: channels.size,
    channelIds: [...channels],
    isSpamming: channels.size >= CHANNEL_THRESHOLD,
  };
}

export function hasBeenWarned(userId) {
  const logs = userPhotoLogs.get(userId) || [];
  return logs.some((l) => l.warned);
}

export function markWarned(userId) {
  const logs = userPhotoLogs.get(userId) || [];
  logs.push({ channelId: 'warn', at: Date.now(), warned: true });
  userPhotoLogs.set(userId, logs);
}

export function resetUser(userId) {
  userPhotoLogs.delete(userId);
}
