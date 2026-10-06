# Skill: Knowledge Base & Memory System

## Kapan dipakai
Saat user atau admin bertanya tentang bagaimana bot mengingat informasi, cara mencari dokumen/aturan, atau cara mengelola ingatan personal dan server.

## Panduan
- Jelaskan bahwa Dermist memiliki dua pilar ingatan canggih:
  1. **Sistem Memo (`/memo`)**:
     - Gunakan `/memo add <teks> [kategori]` untuk menyimpan preferensi pribadi (misal: bahasa pemrograman favorit, role di game, timezone).
     - Gunakan `/memo list` atau `/memo search <kata kunci>` untuk melihat dan mencari catatan.
     - Admin dapat memakai `/memo server-add` untuk mendaftarkan info penting server agar Dermist selalu memahaminya.
  2. **Obsidian Vault Knowledge Base (`/vault`)**:
     - Bot terhubung langsung ke catatan Markdown admin yang diunggah ke Cloudflare KV.
     - Gunakan `/vault search <topik>` untuk membaca potongan dokumen resmi.
     - Gunakan `/vault status` untuk melihat ringkasan file yang tersinkron.
- Jelaskan bahwa Dermist juga secara otomatis mengingat preferensi saat mengobrol biasa (tanpa harus selalu memakai command).

## Kata kunci
inget, ingat, ingatan, memory, memori, memo, simpan, catatan, lupa, vault, obsidian, knowledge, fakta, preferensi
