---
title: Panduan Penggunaan Bot Dermist
tags: [faq, bot, panduan]
---

# Panduan Lengkap Bot Dermist

Dermist adalah bot all-in-one Discord yang ditenagai Cloudflare Workers AI (Llama 3.3 70B) dan sistem ingatan jangka panjang.

## Fitur Utama

### 1. Smart Memory (Memo & Facts)
- `/memo add <teks> [kategori]`: Menyimpan preferensi atau catatan pribadi kamu.
- `/memo list`: Melihat semua catatan pribadi kamu.
- `/memo search <kata kunci>`: Mencari memo berdasarkan kemiripan arti.
- `/memo delete <nomor>`: Menghapus catatan.
- `/facts`: Melihat ringkasan apa saja yang diingat oleh bot tentang kamu.

### 2. Moderasi dan Proteksi Otomatis
- Auto anti-spam & anti toxic detection.
- Cross-channel photo spam detection.
- `/warn <user> <alasan>`: Memberikan warning resmi ke member.
- `/mute <user> <durasi> <alasan>`: Timeout member.
- `/purge <jumlah>`: Menghapus pesan massal.
- `/note add <user> <catatan>`: Catatan rahasia admin mengenai perilaku member.

### 3. Knowledge Base Obsidian Vault
- Catatan yang kamu tulis di Obsidian dapat disinkronkan ke bot via script `npm run vault:sync`.
- Ketika user bertanya tentang aturan atau tutorial server via `/ask` atau mention `@Dermist`, bot akan langsung membaca catatan dari vault Obsidian.
- Gunakan `/vault status` untuk mengecek kapan vault terakhir disinkronkan.
