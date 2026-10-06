/**
 * Shared schemas & validation helpers
 * Digunakan oleh bot dan Workers untuk konsistensi data
 */

// ─── Warning Record ───
export function createWarning({ userId, moderator, reason, severity = 'MEDIUM', auto = false }) {
  return {
    id: `w-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    userId,
    moderator,
    reason,
    severity,
    auto,
    createdAt: Date.now(),
    expired: false,
  };
}

// ─── Daily Stats Record ───
export function createDailyStats(guildId) {
  return {
    guildId,
    date: new Date().toISOString().split('T')[0],
    membersJoined: 0,
    membersLeft: 0,
    messagesTotal: 0,
    warningsIssued: 0,
    mutesIssued: 0,
    kicksIssued: 0,
    bansIssued: 0,
    spamDetected: 0,
    toxicDetected: 0,
    raidAttempts: 0,
    activeUsers: [],
    topChannels: {},
    createdAt: Date.now(),
  };
}

// ─── Server Config Record ───
export function createServerConfig(guildId) {
  return {
    guildId,
    // Notification channels
    adminChannelId: null,
    publicChannelId: null,
    logChannelId: null,
    welcomeChannelId: null,
    // Feature toggles
    features: {
      antiRaid: true,
      warningEscalation: true,
      dailyReport: true,
      autoModeration: true,
      scheduledAnnouncements: true,
    },
    // Escalation overrides (null = use defaults from constants.js)
    escalation: {
      warnToMute: null,
      warnToKick: null,
      warnToBan: null,
      muteDurationMs: null,
      warnDecayDays: null,
    },
    updatedAt: Date.now(),
  };
}

// ─── Moderation Action Log ───
export function createActionLog({ guildId, action, target, moderator, reason, auto = false }) {
  return {
    id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    guildId,
    action,
    target,
    moderator,
    reason,
    auto,
    createdAt: Date.now(),
  };
}
