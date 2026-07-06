# Discord Bot — Moderasi & Manajemen Server

Bot Discord kompleks dengan fitur: welcome/goodbye, auto role, channel management, moderation (kick/ban/mute/warn/purge), server logging, dan slash commands.

## Fitur

| Kategori | Command | Deskripsi |
|----------|---------|-----------|
| Moderasi | `/kick` | Kick member |
| Moderasi | `/ban` | Ban member (opsional hapus pesan) |
| Moderasi | `/mute` | Timeout member (60detik – 7hari) |
| Moderasi | `/unmute` | Hapus timeout |
| Moderasi | `/warn` | Beri peringatan (auto-mute di 3 warn) |
| Moderasi | `/purge` | Hapus 1-100 pesan sekaligus |
| Channel | `/create-channel` | Buat text/voice/announcement/stage |
| Channel | `/create-category` | Buat kategori baru |
| Channel | `/delete-channel` | Hapus channel |
| Channel | `/rename-channel` | Ubah nama channel |
| Channel | `/move-channel` | Pindahkan channel ke kategori lain |
| Channel | `/lock` | Kunci channel |
| Channel | `/unlock` | Buka kunci channel |
| General | `/ping` | Cek latency |
| General | `/serverinfo` | Info lengkap server |

Otomatisasi:
- Pesan welcome & goodbye otomatis saat member join/leave
- Auto role saat member join
- Log aktivitas (join, leave, ban, unban, message delete, kick, mute, warn, channel changes)

---

## Setup

### 1. Buat Bot & Dapatkan Token (Discord Developer Portal)

1. Buka https://discord.com/developers/applications
2. Klik **"New Application"** → kasih nama → klik **Create**
3. Buka tab **"Bot"** di menu kiri
   - Klik **"Reset Token"** → **Copy** token (simpan baik-baik, hanya muncul sekali!)
   - Aktifkan **"Message Content Intent"** (di bawah "Privileged Gateway Intents")
   - Aktifkan **"Server Members Intent"**
   - (Opsional) aktifkan **"Presence Intent"**
4. Buka tab **"OAuth2"**
   - Di bagian **"OAuth2 URL Generator"**, centang:
     - Scopes: `bot`, `applications.commands`
     - Bot Permissions: `Administrator` (atau pilih manual: Manage Channels, Manage Roles, Kick Members, Ban Members, Moderate Members, Manage Messages, View Audit Log, Send Messages, Embed Links)
   - Copy URL yang dihasilkan, buka di browser untuk invite bot ke server kamu
5. Catat:
   - **Token** bot
   - **Application ID** (tab "General Information" → "Application ID")
   - **Guild ID** (klik kanan nama server di Discord → Copy ID, aktifkan Developer Mode di Settings → Advanced)

### 2. Konfigurasi `.env`

Salin `.env.example` menjadi `.env` lalu isi:

```env
DISCORD_TOKEN=token_bot_kamu
CLIENT_ID=application_id_kamu
GUILD_ID=id_server_kamu_untuk_dev
WELCOME_CHANNEL_ID=id_channel_welcome_opsional
AUTO_ROLE_ID=id_role_auto_opsional
LOG_CHANNEL_ID=id_channel_log_opsional
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Register Slash Commands

```bash
npm run deploy
```
- Jika `GUILD_ID` diisi → command langsung muncul di server itu (mode dev)
- Jika kosong → command global (butuh ~1 jam muncul di semua server)

### 5. Jalankan Bot

```bash
npm start
# atau mode watch (auto-restart saat file berubah)
npm run dev
```

---

## Struktur Project

```
discord-bot/
├── .env                    # Konfigurasi (jangan di-commit!)
├── .env.example            # Template konfigurasi
├── .gitignore
├── package.json
├── README.md
└── src/
    ├── index.js            # Entry point
    ├── config.js           # Load config dari .env
    ├── deploy-commands.js  # Register slash commands
    ├── handlers/
    │   └── handler.js      # Auto-load events & commands
    ├── events/
    │   ├── ready.js              # Bot online
    │   ├── interactionCreate.js  # Handle slash commands
    │   ├── guildMemberAdd.js     # Welcome + auto role
    │   ├── guildMemberRemove.js  # Goodbye
    │   ├── guildBanAdd.js        # Log ban
    │   ├── guildBanRemove.js     # Log unban
    │   └── messageDelete.js      # Log pesan dihapus
    ├── commands/
    │   ├── moderation/    (kick, ban, mute, unmute, warn, purge)
    │   ├── channel/       (create-channel, create-category, delete, rename, move, lock, unlock)
    │   └── general/       (ping, serverinfo)
    └── utils/
        ├── logger.js      # Logging ke channel & console
        └── embeds.js      # Template embed (welcome, goodbye, dll)
```

## Cara Nambah Command Baru

Buat file `.js` di folder `src/commands/<kategori>/`:

```js
import { SlashCommandBuilder } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';

export default {
  data: new SlashCommandBuilder()
    .setName('namacommand')
    .setDescription('Deskripsi command'),
  async execute(interaction) {
    await interaction.reply({ embeds: [successEmbed('Halo', 'Berhasil!')] });
  },
};
```

Lalu jalankan `npm run deploy` lagi untuk register command baru.

## Cara Nambah Event Baru

Buat file `.js` di folder `src/events/`:

```js
import { Events } from 'discord.js';

export default {
  name: Events.MessageCreate,
  async execute(message) {
    // logika event
  },
};
```

Handler akan otomatis load file tersebut.

## Lisensi

Bebas dipakai untuk keperluan pribadi/komunitas.
