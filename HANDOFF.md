# HANDOFF — Dermist Bot (Discord AI & Automation Bot)

> Template serah terima. Salin seluruh isi file ini ke sesi AI baru untuk melanjutkan tanpa mengulang konteks.
> **Security: semua secret di file ini berupa placeholder. Nilai asli hanya di `.env` lokal dan `wrangler secret`.**

## 1. Lokasi & cara menjalankan

- **Project root**: `C:\Users\sahrul\Documents\Projects\dermist-bot` (nama `package.json` masih "discord-bot", ini normal)
- Stack: Node.js >= 18, ESM (`"type": "module"`), dependensi hanya `discord.js@14` + `dotenv` di root; Hono di worker.
- Script shortcut (root `package.json`):
  - `npm run dev` → bot (`node --watch src/index.js`)
  - `npm run deploy` → register slash commands ke guild (butuh `GUILD_ID`)
  - `npm run worker:ai:dev` / `worker:ai:deploy` → Hono AI agent (Workers)
  - `npm run worker:cron:dev` / `worker:cron:deploy` → cron jobs (Workers)

## 2. Arsitektur (Hybrid)

```
Discord Gateway (discord.js v14, proses Node.js lokal/VPS)
  ├─ src/events/*  : MessageCreate, GuildMemberAdd/Remove, Ban, VoiceState, Interaction
  ├─ src/utils/    : spam-detect, toxic-detect, photo-spam-detect, anti-raid, voice-afk,
  │                  agent.js (LLM + tool calling), tools.js, memory.js (KV), worker-client.js
  ├─ src/commands/ : ai/ (ask, translate, ...), moderation/, channel/, general/
  └─ worker-client.js → Cloudflare Worker "dermist-ai-agent" (Hono REST API)
       ├─ routes: /ask /chat /extract-facts /moderate /translate (auth via AUTH_SECRET)
       ├─ Workers AI: @cf/meta/llama-3.3-70b-instruct-fp8-fast
       └─ KV DERMIST_KV (memory jangka panjang)
workers/cron-jobs (Worker, cron triggers):
  ├─ 0 1 * * *   (08:00 WIB = 01:00 UTC)  → daily-report
  ├─ */15 * * * *                          → warning-escalation
  └─ */5 * * * *                           → anti-raid-cleanup
```

## 3. Alur 1 pesan (jalur eksekusi)

1. `messageCreate.js` → guard spam/toxic/photo terlebih dahulu (warning/action otomatis).
2. Pesan normal / `/ask` → `agent.js` → `worker-client.js`:
   - Kalau `WORKER_BASE_URL` terisi → POST ke worker (`/ask` atau `/chat`), auth header `AUTH_SECRET`.
   - Kalau kosong → fallback langsung ke REST API Cloudflare (Workers AI + KV) dari bot.
3. Worker: ambil `history:{userId}` + `facts:{userId}` dari KV → prompt LLM → tool calling → simpan `history` baru + ekstrak fact tiap 5 turn (`turns:{userId}`).
4. Balasan dikirim ke channel via embed helper (`src/utils/embeds.js`).

## 4. Skema KV (namespace `DERMIST_KV`, id ada di wrangler.toml)

| Key | Isi | Sumber |
|---|---|---|
| `facts:{userId}` | Array `{text, by, at}` | `src/utils/memory.js` |
| `turns:{userId}` | Int (counter, ekstraksi fact tiap 5) | `src/utils/memory.js` |
| `history:{userId}` | Array `{role, content, at}` (max 20) | `src/utils/memory.js` |
| (key config guild) | Setup server, lihat `src/commands/general/setup.js` | |

## 5. Status env (12 variabel di `.env`)

| Variabel | Status | Keterangan |
|---|---|---|
| `DISCORD_TOKEN` | **KOSONG** | Isi dari Developer Portal → Bot → Reset Token |
| `CLIENT_ID` | **KOSONG** | Developer Portal → General Information → Application ID |
| `GUILD_ID` | **KOSONG** | Server tempat test slash command (Developer Mode → Copy ID) |
| `WELCOME_CHANNEL_ID` / `AUTO_ROLE_ID` / `LOG_CHANNEL_ID` | KOSONG (opsional) | Kosongkan = fitur nonaktif |
| `CF_ACCOUNT_ID` | TERISI | Akun pribadi |
| `CF_API_TOKEN` | TERISI | **PERLU DI-ROTATE**: pernah bocor di chat AI. Buat token baru, izin Workers AI + KV |
| `CF_KV_NAMESPACE_ID` | TERISI | `DERMIST_KV` |
| `CF_KV_TOKEN` | TERISI | Bisa sama dengan `CF_API_TOKEN` |
| `WORKER_BASE_URL` | **KOSONG** | Diisi URL worker setelah deploy, contoh `https://dermist-ai-agent.<subdomain>.workers.dev` |
| `WORKER_AUTH_SECRET` | **KOSONG** | Sama dengan `wrangler secret put AUTH_SECRET` di worker |

**Penting**: integrasi bot ↔ worker **belum aktif end-to-end** sampai `WORKER_BASE_URL` + `WORKER_AUTH_SECRET` terisi (sekarang bot pakai fallback REST API langsung).

## 6. Langkah selanjutnya (urutan)

1. Rotate `CF_API_TOKEN` (wajib, karena bocor) → update `.env`.
2. Isi `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID` → `npm run deploy` → `npm run dev`, test `/ask`, moderasi, anti-raid di server test.
3. Deploy worker: `npm run worker:ai:deploy` lalu `npm run worker:cron:deploy` (butuh `wrangler login`).
4. `wrangler secret put AUTH_SECRET` di `workers/ai-agent` (nilai = `WORKER_AUTH_SECRET`).
5. Isi `WORKER_BASE_URL` + `WORKER_AUTH_SECRET` di `.env`, restart bot, verifikasi worker-client memakai worker (log sukses, bukan fallback).
6. **Keputusan hosting 24/7 (belum dipilih)**: Dockerfile + Railway/Fly.io, atau VPS + PM2. Bot Discord wajib proses aktif 24/7; worker Cloudflare sudah otomatis.

## 7. Perintah verifikasi (jalankan sebelum lapor "selesai")

- `node --check` pada setiap file yang diedit.
- `npm run dev` start tanpa error di log (`bot.log`).
- `npm run deploy` sukses (slash commands muncul di Discord).
- `npm run worker:ai:dev` respon `/ask` lokal.
- KV smoke test: read/write/delete satu key test via curl (URL REST API KV di `src/utils/memory.js`).
- Grep `ephemeral:` dan `fetchReply` = 0 hasil (sudah dimigrasi ke `MessageFlags.Ephemeral` / `withResponse`).

## 8. Konvensi & aturan

- ESM, default export, `data` = SlashCommandBuilder, `execute(interaction)`.
- Semua reply pakai embed helper (`src/utils/embeds.js`), log via `src/utils/logger.js`.
- JANGAN menambah dependency baru (kecuali diizinkan eksplisit). JANGAN commit.
- Jadwal WIB = UTC-7 (cron sudah benar di wrangler.toml).
- `PROMPT.md` berisi task upgrade fase 1-10 (interaksi komponen, modals, subcommands, autocomplete, context menu, collectors, ESLint) — beberapa sudah dikerjakan, verifikasi Acceptance Criteria-nya sebelum lanjut.