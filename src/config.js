import 'dotenv/config';

function required(key) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Environment variable ${key} belum diisi. Cek file .env kamu.`);
  }
  return value;
}

function optional(key) {
  return process.env[key] || null;
}

export const config = {
  token: required('DISCORD_TOKEN'),
  clientId: required('CLIENT_ID'),
  guildId: optional('GUILD_ID'),
  welcomeChannelId: optional('WELCOME_CHANNEL_ID'),
  autoRoleId: optional('AUTO_ROLE_ID'),
  logChannelId: optional('LOG_CHANNEL_ID'),
  embedColor: 0x5865f2,
  cfAccountId: required('CF_ACCOUNT_ID'),
  cfApiToken: required('CF_API_TOKEN'),
  cfKvNamespaceId: optional('CF_KV_NAMESPACE_ID'),
  cfKvToken: optional('CF_KV_TOKEN'),
};
