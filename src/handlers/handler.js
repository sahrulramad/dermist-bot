import { readdirSync } from 'fs';
import { pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { Collection } from 'discord.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function loadCommands(client) {
  const commands = new Collection();
  const foldersPath = join(__dirname, '..', 'commands');
  const commandFolders = readdirSync(foldersPath);

  for (const folder of commandFolders) {
    const folderPath = join(foldersPath, folder);
    const commandFiles = readdirSync(folderPath).filter((file) => file.endsWith('.js'));

    for (const file of commandFiles) {
      const filePath = pathToFileURL(join(folderPath, file)).href;
      const command = (await import(filePath)).default;

      if (!command?.data?.name || !command?.execute) {
        console.warn(`[WARNING] Command ${file} tidak punya "data" atau "execute".`);
        continue;
      }

      commands.set(command.data.name, command);
      console.log(`[COMMAND] Loaded: /${command.data.name}`);
    }
  }

  client.commands = commands;
  return commands;
}

export async function loadEvents(client) {
  const eventsPath = join(__dirname, '..', 'events');
  const eventFiles = readdirSync(eventsPath).filter((file) => file.endsWith('.js'));

  for (const file of eventFiles) {
    const filePath = pathToFileURL(join(eventsPath, file)).href;
    const event = (await import(filePath)).default;

    if (!event?.name || !event?.execute) {
      console.warn(`[WARNING] Event ${file} tidak punya "name" atau "execute".`);
      continue;
    }

    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args));
    } else {
      client.on(event.name, (...args) => event.execute(...args));
    }

    console.log(`[EVENT] Loaded: ${event.name}`);
  }
}
