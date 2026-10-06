import { Client, Events, GatewayIntentBits, Partials } from 'discord.js';
import { config, assertBotConfig } from './config.js';
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

process.on('unhandledRejection', (err) => {
  log(`Unhandled rejection: ${err?.stack ?? err}`, 'error');
});
process.on('uncaughtException', (err) => {
  log(`Uncaught exception: ${err?.stack ?? err}`, 'error');
});

client.on(Events.Error, (err) => {
  log(`Client error: ${err?.stack ?? err}`, 'error');
});

async function main() {
  assertBotConfig();
  await loadCommands(client);
  await loadEvents(client);
  await client.login(config.token);
  startVoiceAfkChecker(client);
}

main();
