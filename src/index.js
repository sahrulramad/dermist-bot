import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { config } from './config.js';
import { loadCommands, loadEvents } from './handlers/handler.js';
import { log } from './utils/logger.js';
import { startVoiceAfkChecker } from './utils/voice-afk.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [Partials.GuildMember, Partials.Message, Partials.Channel],
});

client.once('unhandledRejection', (err) => {
  log(`Unhandled rejection: ${err.stack}`, 'error');
});

async function main() {
  await loadCommands(client);
  await loadEvents(client);
  await client.login(config.token);
  startVoiceAfkChecker(client);
}

main();
