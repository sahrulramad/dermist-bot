import 'dotenv/config';

function getEnv(key, isRequired = false) {
  const value = process.env[key] || '';
  return value;
}

export const config = {
  token: getEnv('DISCORD_TOKEN', true),
  clientId: getEnv('CLIENT_ID', true),
  guildId: getEnv('GUILD_ID'),
  welcomeChannelId: getEnv('WELCOME_CHANNEL_ID'),
  autoRoleId: getEnv('AUTO_ROLE_ID'),
  logChannelId: getEnv('LOG_CHANNEL_ID'),
  embedColor: 0x5865f2,
  cfAccountId: getEnv('CF_ACCOUNT_ID', true),
  cfApiToken: getEnv('CF_API_TOKEN', true),
  cfKvNamespaceId: getEnv('CF_KV_NAMESPACE_ID'),
  cfKvToken: getEnv('CF_KV_TOKEN') || getEnv('CF_API_TOKEN'),
  workerBaseUrl: getEnv('WORKER_BASE_URL'),
  workerAuthSecret: getEnv('WORKER_AUTH_SECRET'),
};

export function assertBotConfig() {
  const missing = [];
  if (!config.token) missing.push('DISCORD_TOKEN');
  if (!config.clientId) missing.push('CLIENT_ID');
  if (!config.cfAccountId) missing.push('CF_ACCOUNT_ID');
  if (!config.cfApiToken) missing.push('CF_API_TOKEN');

  if (missing.length > 0) {
    throw new Error(`Environment variable berikut belum diisi di .env: ${missing.join(', ')}`);
  }
}
