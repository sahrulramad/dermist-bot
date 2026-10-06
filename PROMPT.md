# PROMPT KERJA — Upgrade dermist-bot (discord.js v14, sesuai discordjs.guide/legacy)

Kamu bekerja di repo **dermist-bot** (bot Discord discord.js v14, ESM `"type": "module"`, Node >=18, hanya dependensi `discord.js` + `dotenv`).

**Konteks:** Bot sudah punya: handler dinamis commands/events (`src/handlers/handler.js`), deploy slash commands (`src/deploy-commands.js`), commands `/kick /ban /mute /unmute /warn /purge`, channel management, welcome/autorole, logging, auto-moderasi (spam/toxic/photo/AFK), AI agent via Cloudflare Workers AI (`src/utils/agent.js`, `src/utils/tools.js`), memory KV (`src/utils/memory.js`).

**Aturan global:**
- Ikuti struktur & style yang sudah ada: default export, `data` = SlashCommandBuilder, `execute(interaction)`, embed helper di `src/utils/embeds.js`, log via `src/utils/logger.js`.
- JANGAN menambah dependency baru (pakai `discord.js` bawaan saja).
- JANGAN commit. JANGAN ubah file yang tidak disebut. Semua reply pakai embed helper yang ada.
- Setelah tiap fase, jalankan `node --check` pada file yang diedit (tanpa menyalakan bot) untuk memastikan tidak ada syntax error.

---

## FASE 1 — Fix error handling (PRIORITAS, bug nyata)

**File: `src/index.js`**

1. Hapus `client.once('unhandledRejection', ...)` — ini SALAH, `unhandledRejection` adalah event **process**, bukan event client, sehingga tidak pernah aktif.
2. Ganti dengan:
   ```js
   process.on('unhandledRejection', (err) => {
     log(`Unhandled rejection: ${err?.stack ?? err}`, 'error');
   });
   process.on('uncaughtException', (err) => {
     log(`Uncaught exception: ${err?.stack ?? err}`, 'error');
   });
   ```
3. Tambahkan juga `client.on('error', (err) => log(`Client error: ${err.stack}`, 'error'));` (pakai `Events.Error` dari `discord.js`).
4. Ganti `new Map()` di `src/handlers/handler.js` dengan `new Collection()` dari `discord.js` (punya helper seperti `.rest()`, `.filter()` — sesuai guide).

## FASE 2 — Hapus API deprecated (d.js v14 baru)

1. Ganti SEMUA `ephemeral: true` di seluruh repo menjadi `flags: MessageFlags.Ephemeral` (import `MessageFlags` dari `discord.js`).
2. Di `src/commands/general/ping.js`, ganti `fetchReply: true` dengan `withResponse: true` dan sesuaikan cara ambil `createdTimestamp` dari `interaction.fetchReply()` / response resource.
3. Verifikasi tidak ada lagi string `ephemeral:` / `fetchReply` di `src/` (grep harus 0 hasil).

## FASE 3 — Buttons & Select Menus (bab "Slash Commands" guide)

**Tujuan: interaksi komponen (sekarang 0 ada).**

1. Buat `src/events/interactionCreate.js` menangani juga:
   - `interaction.isButton()` → dispatch ke handler berdasar `customId` prefix (mis. `mod:kick:<userId>`, `log:delete:<id>`).
   - `interaction.isStringSelectMenu()` → sama seperti di atas.
2. Buat folder `src/components/` dengan file handler per fitur (pola mirip commands):
   - `confirm-action.js`: generic handler tombol Confirm/Cancel dengan customId format `confirm:<action>:<payload>`.
3. Contoh penerapan konkret:
   - `/warn` → setelah memberi warn, reply embed berisi **tombol "Mute 10 menit"** (customId `warn:mute:<userId>`) yang hanya bisa diklik oleh moderator, pakai `ActionRowBuilder` + `ButtonBuilder`.
   - `/purge` → sebelum eksekusi, tampilkan tombol **Confirm/Cancel** (`purge:confirm` / `purge:cancel`); confirm wajib `interactionUpdate` lalu jalankan bulk delete.
4. Simpan executor id di customId untuk validasi: hanya user yang menjalankan command yang boleh klik (kalau bukan, reply error embed ephemeral).
5. Timeout: kalau komponen kedaluwarsa, edit reply jadi embed "Kedaluwarsa" dan matikan tombol (`.setDisabled(true)`).

## FASE 4 — Modals

1. Tambah handler `interaction.isModalSubmit()` di `interactionCreate.js`.
2. Penerapan: tombol di `/warn` bernama **"Tulis Alasan Manual"** (`warn:reason:<userId>`) → `ModalBuilder` dengan `TextInputBuilder` (paragraph, 1–500 char) → saat submit, simpan warn dengan alasan tersebut ke log channel (pakai `sendLog` yang sudah ada).
3. CustomId modal juga pakai format prefix `modal:warn-reason:<userId>` dan tervalidasi executor.

## FASE 5 — Subcommands

1. Jadikan `/create-channel` memiliki subcommand: `text`, `voice`, `announcement` (pindahkan logika opsi `tipe` saat ini ke subcommands).
2. Jadikan `/mute` & `/unmute` jadi satu command `/timeout` dengan subcommand `add` dan `remove`.
3. Pastikan `deploy-commands.js` tetap bekerja (data.toJSON otomatis menyertakan subcommands).

## FASE 6 — Autocomplete

1. Di `interactionCreate.js`, tambah branch `interaction.isAutocomplete()`.
2. Terapkan pada `/translate` (`src/commands/ai/translate.js`): opsi `bahasa` autocomplete dengan daftar ~15 bahasa, filtered dari `interaction.options.getFocused()`. Register via `.setAutocomplete(true)` pada opsi dan tangani di command file via properti `autocomplete: async (interaction) => {...}` (pola: interactionCreate cek `command.autocomplete` lalu panggil dan `respond()`).

## FASE 7 — Context Menu Commands

1. Buat `src/commands/context/` berisi 2 context menu:
   - **Report Message** (`MessageContextMenuCommandBuilder`): kirim embed laporan ke `LOG_CHANNEL_ID` dengan jump link + isi pesan.
   - **User Info** (`UserContextMenuCommandBuilder`): embed info user (tag, id, dibuat, join server, roles).
2. Handler `interactionCreate.js`: tambah branch `interaction.isMessageContextMenu()` dan `interaction.isUserContextMenu()`, dispatch sama seperti chat command (object command tetap punya `data` & `execute`).

## FASE 8 — Collectors & Reactions

1. Di command `/help` (`src/commands/general/help.js`): ganti tampilan jadi **paged embed dengan tombol Prev/Next** yang memakai `createMessageComponentCollector` (timeout 3 menit, hanya executor yang bisa navigasi, auto-stop setelah idle).
2. Di event welcome (`src/events/guildMemberAdd.js`): tambah reaksi 🎉 otomatis ke pesan welcome (`.react()`), dengan try/catch jika tidak punya izin `AddReactions`.

## FASE 9 — Threads & Webhooks (opsional tapi disarankan)

1. `/serverinfo` → tambah field jumlah active threads (`guild.channels.cache.filter(c => c.isThread()).size`) via `guild.channels.fetchActiveThreads()`.
2. Logging (`src/utils/logger.js`): kirim log via **WebhookClient** dari env baru `LOG_WEBHOOK_URL` (opsional, fallback ke `sendLog` biasa jika kosong). Tambahkan `LOG_WEBHOOK_URL=` ke `.env.example` dengan komentar.

## FASE 10 — ESLint (bab "Improving Your Dev Environment")

1. Jalankan `npm install --save-dev eslint@9 globals` (satu-satunya dependency baru yang diizinkan).
2. Buat `eslint.config.js` (flat config) untuk file `src/**/*.js`, ESM, `ecmaVersion: 2024`, globals browser/node, aturan: `no-unused-vars` warn, `no-undef` error.
3. Tambah script `"lint": "eslint src"` di `package.json`. Pastikan `npm run lint` lolos 0 error (warning boleh).

---

## Acceptance Criteria (semua wajib dicek di akhir)

- [ ] `process.on('unhandledRejection'/'uncaughtException')` terpasang; `client.once('unhandledRejection')` hilang.
- [ ] Grep `ephemeral:` = 0 hasil, `fetchReply` = 0 hasil.
- [ ] `interactionCreate.js` menangani: chat input, buttons, select menu, modal, autocomplete, 2 context menu.
- [ ] `/warn` punya tombol mute + modal alasan; `/purge` pakai confirm/cancel.
- [ ] `/create-channel` & `/timeout` memakai subcommands; `npm run deploy` tetap sukses.
- [ ] `/translate` punya autocomplete; `/help` punya pagination collector.
- [ ] `npm run lint` lolos.
- [ ] `node --check src/index.js src/deploy-commands.js src/events/interactionCreate.js` lolos semua.
- [ ] Semua fitur lama (moderasi, channel, welcome, AI agent, auto-mod) TIDAK berubah perilakunya.

## Urutan kerja
Fase 1 → 2 dulu (fix + modernisasi), commit mental per fase. Lalu 3–7 (fitur interaksi). Terakhir 8–10. Laporkan ringkasan perubahan per fase sebelum lanjut.
