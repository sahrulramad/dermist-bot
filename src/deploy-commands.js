import { REST, Routes } from 'discord.js';
import { readdirSync } from 'fs';
import { pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function getCommands() {
  const commands = [];
  const foldersPath = join(__dirname, 'commands');
  const commandFolders = readdirSync(foldersPath);

  for (const folder of commandFolders) {
    const folderPath = join(foldersPath, folder);
    const commandFiles = readdirSync(folderPath).filter((file) => file.endsWith('.js'));

    for (const file of commandFiles) {
      const filePath = pathToFileURL(join(folderPath, file)).href;
      const command = (await import(filePath)).default;
      if (command?.data?.toJSON) {
        commands.push(command.data.toJSON());
      }
    }
  }

  return commands;
}

async function deploy() {
  const commands = await getCommands();
  const rest = new REST({ version: '10' }).setToken(config.token);

  try {
    console.log(`Mulai register ${commands.length} slash command...`);

    if (config.guildId) {
      // Register ke guild tertentu (instan, untuk dev)
      const data = await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body: commands });
      console.log(`✅ Berhasil register ${data.length} command ke guild ${config.guildId} (mode dev).`);
    } else {
      // Register global (butuh ~1 jam untuk muncul di semua server)
      const data = await rest.put(Routes.applicationCommands(config.clientId), { body: commands });
      console.log(`✅ Berhasil register ${data.length} command secara global.`);
      console.log('   Catatan: command global butuh ~1 jam untuk muncul di semua server.');
    }
  } catch (err) {
    console.error('❌ Gagal register command:', err);
  }
}

deploy();
