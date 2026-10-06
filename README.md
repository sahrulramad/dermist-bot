# 🤖 Dermist Bot — Hybrid Discord AI Agent & Server Automation Platform

[![Node.js Version](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Discord.js](https://img.shields.io/badge/Discord.js-v14.16-5865F2?logo=discord&logoColor=white)](https://discord.js.org/)
[![Cloudflare Workers AI](https://img.shields.io/badge/Cloudflare_Workers_AI-Llama_3.3_70B-F38020?logo=cloudflare&logoColor=white)](https://developers.cloudflare.com/workers-ai/)
[![Architecture](https://img.shields.io/badge/Architecture-Hybrid_Event_Driven-blue)](#-arsitektur-sistem-hybrid)

**Dermist Bot** adalah platform bot Discord modern berarsitektur **hybrid** yang menggabungkan automasi operasional server (event-driven gateway) dengan **Autonomous AI Agent** bertenaga **Cloudflare Workers AI (Meta Llama 3.3 70B)**. Dilengkapi dengan memori persisten jangka panjang (Cloudflare KV), orkestrasi tool-calling, sistem modular skills, pemantauan anti-raid, dan scheduled cron jobs.

---

## 🏛️ Arsitektur Sistem (Hybrid)

```text
                         ┌────────────────────────────────────────────────┐
                         │              Discord Client / User             │
                         └───────────────────────┬────────────────────────┘
                                                 │ Gateway Events & Slash Commands
                                                 ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│              Discord.js Gateway Core (Node.js Runtime / VPS / Local)            │
│                                                                                 │
│  [Event Dispatchers]       [Automated Guards]          [Agent Orchestrator]     │
│  • MessageCreate           • Anti-Spam & Rate Limit    • agent.js (Tool Calling)│
│  • GuildMemberAdd / Remove • Toxic Text Classifier     • tools.js               │
│  • VoiceStateUpdate        • Photo-Spam Guard          • skills.js Loader       │
│  • Audit Logging           • Voice AFK Auto-Move       • memory.js Client       │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │ REST API / Fallback Workers AI
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                     Serverless Cloudflare Workers Ecosystem                     │
│                                                                                 │
│   ┌───────────────────────────────────┐    ┌──────────────────────────────────┐ │
│   │   Worker: dermist-ai-agent (Hono) │    │   Worker: dermist-cron-jobs      │ │
│   │   • Llama 3.3 70B Instruct        │    │   • 08:00 WIB Daily Report       │ │
│   │   • Contextual Memory Assembly    │    │   • Warning Escalation Routine   │ │
│   │   • Fact Extraction Engine        │    │   • Anti-Raid State Cleanup      │ │
│   └─────────────────┬─────────────────┘    └────────────────┬─────────────────┘ │
│                     │                                       │                   │
│                     └───────────────────┬───────────────────┘                   │
│                                         ▼                                       │
│                           [ Cloudflare KV: DERMIST_KV ]                         │
│                    • history:{userId}  • facts:{userId}                         │
│                    • server_rules      • server_config                          │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## ⚡ Fitur Utama

### 1. 🧠 Autonomous AI Agent & Contextual Memory
* **LLM Core:** Didukung model **Meta Llama 3.3 70B Instruct** via Cloudflare Workers AI untuk penalaran cerdas dan latensi rendah.
* **Tool Calling Orchestration:** AI mampu memanggil tools internal bot secara otonom untuk mengambil informasi server, mencari aturan vault, dan mengeksekusi aksi.
* **Persistent KV Memory:** Mengingat riwayat percakapan (`history:{userId}`) serta mengekstrak fakta personal pengguna secara berkala (`facts:{userId}`) menggunakan Cloudflare KV.
* **Modular Skills System:** Perilaku dan SOP bot diatur melalui file panduan Markdown modular (`src/skills/`), memungkinkan penyesuaian persona dan alur kerja tanpa modifikasi kode inti.
* **Knowledge Vault:** Integrasi knowledge base (`vault/faq/`, `vault/rules/`) untuk menjawab pertanyaan seputar server secara akurat.

### 2. 🛡️ Automasi Moderasi & Keamanan Server
* **Anti-Raid & Spam Protection:** Deteksi otomatis lonjakan pesan spam, toxic behavior, dan flooding gambar dengan aksi mute/timeout berjenjang.
* **Auto-Moderation Commands:** `/kick`, `/ban`, `/mute`, `/unmute`, `/warn` (auto-escalation pada 3x warning), dan `/purge`.
* **Voice AFK Management:** Deteksi otomatis user yang tidak aktif di voice channel dan pemindahan ke AFK room.
* **Audit Logging Real-time:** Pencatatan otomatis ke dedicated log channel untuk aksi join, leave, role updates, pesan terhapus, dan penalti moderasi.

### 3. ⏱️ Serverless Cron Jobs (Automasi Terjadwal)
* **Daily Server Report:** Ringkasan statistik aktivitas server harian otomatis pada pukul 08:00 WIB.
* **Warning Escalation:** Pengecekan status pelanggaran member secara berkala setiap 15 menit.
* **State Maintenance:** Pembersihan buffer state anti-raid setiap 5 menit.

---

## 📜 Daftar Command

| Kategori | Command | Deskripsi |
| :--- | :--- | :--- |
| **AI Agent** | `/ask <pertanyaan>` | Bertanya ke AI agent dengan konteks server & memory |
| **AI Agent** | `/remember <fakta>` | Menyimpan fakta spesifik pengguna ke memori KV |
| **AI Agent** | `/facts` | Melihat kumpulan fakta yang diingat AI tentang user |
| **AI Agent** | `/memo` | Mengelola memo dan catatan internal |
| **AI Agent** | `/vault` | Menjelajahi dokumen panduan & knowledge base |
| **Moderasi** | `/warn <user> <alasan>` | Memberikan peringatan resmi (escalates automatically) |
| **Moderasi** | `/mute <user> <durasi>` | Timeout anggota sementara (60s s/d 7 hari) |
| **Moderasi** | `/unmute <user>` | Menghapus status timeout |
| **Moderasi** | `/kick <user> <alasan>` | Mengeluarkan anggota dari server |
| **Moderasi** | `/ban <user> [hari]` | Memblokir anggota permanen |
| **Moderasi** | `/purge <jumlah>` | Menghapus 1–100 pesan sekaligus |
| **Channel** | `/create-channel` | Membuat text, voice, atau announcement channel |
| **Channel** | `/delete-channel` | Menghapus channel dengan konfirmasi |
| **Channel** | `/lock` & `/unlock` | Mengunci atau membuka akses chat channel |
| **General** | `/setup-server` | Setup otomatis kategori, role, dan channel server |
| **General** | `/ping` & `/help` | Cek latency bot dan panduan bantuan |

---

## 📂 Struktur Direktori

```text
dermist-bot/
├── src/
│   ├── index.js                  # Entrypoint Discord Gateway Client
│   ├── config.js                 # Central environment & validation config
│   ├── deploy-commands.js        # Deployment script slash commands ke Discord API
│   ├── commands/                 # Handler slash commands per kategori
│   │   ├── ai/                   # ask, remember, facts, memo, vault
│   │   ├── moderation/           # kick, ban, mute, unmute, warn, purge, note
│   │   ├── channel/              # create, delete, rename, lock, unlock
│   │   └── general/              # help, ping, setup, setup-server
│   ├── events/                   # Discord gateway event listeners
│   │   ├── messageCreate.js      # Message processing & security guard
│   │   ├── interactionCreate.js  # Slash command execution router
│   │   ├── guildMemberAdd.js     # Auto-role & welcome handler
│   │   └── voiceStateUpdate.js   # Voice channel AFK detection
│   ├── handlers/                 # Dynamic command & event loader
│   ├── skills/                   # Markdown-defined agent behavioral skills
│   └── utils/                    # Core modules (agent, tools, memory, logger, anti-raid)
├── vault/                        # Server knowledge base & SOP documents
│   ├── faq/                      # Frequently Asked Questions
│   └── rules/                    # Official server guidelines
├── workers/                      # Cloudflare Serverless Workers
│   ├── ai-agent/                 # Hono REST API for Llama 3.3 70B & KV memory
│   └── cron-jobs/                # Scheduled cron trigger routines
├── .env.example                  # Environment variables template
├── package.json
└── README.md
```

---

## 🚀 Panduan Setup & Instalasi

### 1. Prasyarat
* Node.js >= 18.0.0
* Akun Cloudflare (untuk Workers AI & Cloudflare KV)
* Discord Bot Token & Application ID dari [Discord Developer Portal](https://discord.com/developers/applications)

### 2. Instalasi Dependensi
```bash
# Clone repository
git clone https://github.com/sahrulramad/dermist-bot.git
cd dermist-bot

# Install root dependencies
npm install
```

### 3. Konfigurasi Environment (`.env`)
Salin `.env.example` menjadi `.env` dan sesuaikan konfigurasinya:
```env
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_discord_application_id
GUILD_ID=your_test_guild_id

# Cloudflare Configuration
CF_ACCOUNT_ID=your_cloudflare_account_id
CF_API_TOKEN=your_cloudflare_api_token
CF_KV_NAMESPACE_ID=your_kv_namespace_id

# Worker Integration (Opsional / Production)
WORKER_BASE_URL=https://dermist-ai-agent.<your-subdomain>.workers.dev
WORKER_AUTH_SECRET=your_worker_auth_secret
```

### 4. Deploy Slash Commands & Jalankan Bot
```bash
# Daftarkan slash commands ke server
npm run deploy

# Jalankan bot (Development mode dengan auto-reload)
npm run dev

# Jalankan bot (Production mode)
npm start
```

---

## 📄 Lisensi

Proyek ini dilisensikan di bawah lisensi pribadi/komunitas. Dibuat dan dikembangkan oleh **[Syahrul Ramadhon](https://github.com/sahrulramad)**.
