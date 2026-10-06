import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { embed } from '../src/utils/embeddings.js';

// ─── Configuration ───
const accountId = process.env.CF_ACCOUNT_ID;
const kvNamespaceId = process.env.CF_KV_NAMESPACE_ID;
const kvToken = process.env.CF_KV_TOKEN || process.env.CF_API_TOKEN;

if (!accountId || !kvNamespaceId || !kvToken) {
  console.error('❌ Error: CF_ACCOUNT_ID, CF_KV_NAMESPACE_ID, atau CF_KV_TOKEN belum diisi di .env');
  process.exit(1);
}

const KV_BASE = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${kvNamespaceId}/values`;
const KV_HEADERS = {
  Authorization: `Bearer ${kvToken}`,
  'Content-Type': 'application/json',
};

// ─── CLI Args ───
function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : null;
}

const rawPath = getArg('--path') || process.env.OBSIDIAN_VAULT_PATH || './vault';
const targetDir = path.resolve(process.cwd(), rawPath);

console.log('═══════════════════════════════════════════════════════════');
console.log('📚 Dermist Bot — Obsidian Vault Knowledge Sync');
console.log('═══════════════════════════════════════════════════════════');
console.log(`📂 Direktori Vault : ${targetDir}`);
console.log(`☁️ Cloudflare KV    : ${kvNamespaceId.slice(0, 8)}...`);

if (!fs.existsSync(targetDir)) {
  console.error(`\n❌ Error: Direktori vault tidak ditemukan di: ${targetDir}`);
  console.log('Tips: Buat folder ./vault atau jalankan:');
  console.log('  node scripts/vault-sync.js --path "C:/Path/Ke/Vault/Obsidian"');
  process.exit(1);
}

// ─── Helper: Rekursif cari file .md ───
function scanMarkdownFiles(dir) {
  let files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    // Lewati folder internal Obsidian, Git, atau system
    if (entry.isDirectory()) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name.toLowerCase() === 'trash') {
        continue;
      }
      files = files.concat(scanMarkdownFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }
  return files;
}

// ─── Helper: Parse Frontmatter & Clean Markdown ───
function parseMarkdown(content, filename) {
  let text = content;
  let title = path.basename(filename, '.md');
  let tags = [];

  // Parse YAML Frontmatter (---\n ... \n---)
  const fmMatch = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (fmMatch) {
    const fm = fmMatch[1];
    text = text.slice(fmMatch[0].length);

    const titleMatch = fm.match(/title:\s*["']?([^"'\n\r]+)["']?/i);
    if (titleMatch) title = titleMatch[1].trim();

    const tagsMatch = fm.match(/tags:\s*\[?(.*?)\]?$/m);
    if (tagsMatch) {
      tags = tagsMatch[1]
        .split(',')
        .map((t) => t.trim().replace(/^#/, ''))
        .filter(Boolean);
    }
  }

  // Jika belum ada judul khusus, cari H1 pertama (# Judul)
  const h1Match = text.match(/^#\s+([^\n\r]+)/m);
  if (h1Match && title === path.basename(filename, '.md')) {
    title = h1Match[1].trim();
  }

  // Bersihkan internal Obsidian wikilinks: [[Link|Alias]] -> Alias, [[Link]] -> Link
  text = text.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2');
  text = text.replace(/\[\[([^\]]+)\]\]/g, '$1');

  // Bersihkan embedded Obsidian media ![[image.png]]
  text = text.replace(/!\[\[[^\]]+\]\]/g, '');

  return { title, tags, text };
}

// ─── Helper: Chunking Markdown ───
function chunkDocument(doc, relativePath) {
  const { title, tags, text } = doc;
  const chunks = [];

  // Split berdasarkan heading ## atau ###
  const sections = text.split(/(?=^#{2,3}\s+)/m);

  for (let sIdx = 0; sIdx < sections.length; sIdx++) {
    const rawSection = sections[sIdx].trim();
    if (!rawSection || rawSection.length < 20) continue;

    // Ambil heading section
    const headingMatch = rawSection.match(/^#{2,3}\s+([^\n\r]+)/);
    const heading = headingMatch ? headingMatch[1].trim() : sIdx === 0 ? 'Pengantar' : `Bagian ${sIdx + 1}`;

    // Bersihkan isi dari heading markdown
    let body = rawSection;
    if (headingMatch) {
      body = rawSection.slice(headingMatch[0].length).trim();
    }

    if (!body) continue;

    // Jika section terlalu panjang (> 1500 karakter), potong per paragraf
    if (body.length > 1500) {
      const paragraphs = body.split(/\n\s*\n/);
      let buffer = '';

      for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
        const p = paragraphs[pIdx].trim();
        if ((buffer + '\n\n' + p).length > 1200 && buffer.length > 0) {
          pushChunk(chunks, relativePath, title, `${heading} (P${chunks.length + 1})`, tags, buffer);
          buffer = p;
        } else {
          buffer = buffer ? buffer + '\n\n' + p : p;
        }
      }
      if (buffer.trim()) {
        pushChunk(chunks, relativePath, title, `${heading} (P${chunks.length + 1})`, tags, buffer);
      }
    } else {
      pushChunk(chunks, relativePath, title, heading, tags, body);
    }
  }

  // Jika dokumen tidak punya heading tapi ada teks
  if (chunks.length === 0 && text.trim().length >= 20) {
    pushChunk(chunks, relativePath, title, 'Utama', tags, text.trim());
  }

  return chunks;
}

function pushChunk(chunks, relativePath, title, heading, tags, content) {
  const idHash = crypto
    .createHash('md5')
    .update(`${relativePath}::${heading}::${content.slice(0, 100)}`)
    .digest('hex')
    .slice(0, 12);

  const preview = content.slice(0, 200).replace(/\s+/g, ' ').trim();
  const searchContent = `${title} ${heading} ${tags.join(' ')} ${content}`.slice(0, 1000);
  const vector = Array.from(embed(searchContent)); // Convert Float32Array to regular array for JSON

  chunks.push({
    id: `chunk_${idHash}`,
    file: relativePath.replace(/\\/g, '/'),
    title,
    heading,
    tags,
    preview,
    content,
    vector,
  });
}

// ─── KV Upload with Concurrency Limit ───
async function uploadToKV(key, value) {
  const url = `${KV_BASE}/${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: KV_HEADERS,
    body: JSON.stringify(value),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gagal upload ${key} (${res.status}): ${errText}`);
  }
}

// ─── Main Execution ───
async function main() {
  const mdFiles = scanMarkdownFiles(targetDir);
  console.log(`\n🔍 Menemukan ${mdFiles.length} file markdown.`);

  if (mdFiles.length === 0) {
    console.log('⚠️ Tidak ada file .md untuk disinkronkan.');
    return;
  }

  const allChunks = [];
  let totalBytes = 0;

  for (const filePath of mdFiles) {
    const content = fs.readFileSync(filePath, 'utf-8');
    totalBytes += Buffer.byteLength(content, 'utf-8');
    const relativePath = path.relative(targetDir, filePath);
    const parsed = parseMarkdown(content, filePath);
    const chunks = chunkDocument(parsed, relativePath);
    allChunks.push(...chunks);
  }

  console.log(`✂️ Dibuat ${allChunks.length} chunk dari ${mdFiles.length} dokumen (${(totalBytes / 1024).toFixed(1)} KB).`);
  console.log('🚀 Mengunggah chunk ke Cloudflare KV...\n');

  // Siapkan index ringkas untuk pencarian cepat
  const index = allChunks.map((c) => ({
    id: c.id,
    file: c.file,
    title: c.title,
    heading: c.heading,
    tags: c.tags,
    preview: c.preview,
    vector: c.vector,
  }));

  // Upload chunks secara paralel (maks 8 concurrent)
  const CONCURRENCY = 8;
  let successCount = 0;

  for (let i = 0; i < allChunks.length; i += CONCURRENCY) {
    const batch = allChunks.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (c) => {
        const payload = {
          id: c.id,
          file: c.file,
          title: c.title,
          heading: c.heading,
          tags: c.tags,
          content: c.content,
          updatedAt: Date.now(),
        };
        await uploadToKV(`vault:chunk:${c.id}`, payload);
        successCount++;
        process.stdout.write(`\r  [${successCount}/${allChunks.length}] Uploaded: ${c.title} > ${c.heading}`.padEnd(70));
      })
    );
  }

  console.log('\n\n📑 Mengunggah index dan metadata...');

  // Upload Index
  await uploadToKV('vault:index', index);

  // Upload Metadata
  const meta = {
    lastSyncAt: Date.now(),
    totalFiles: mdFiles.length,
    totalChunks: allChunks.length,
    vaultPath: targetDir,
    fileSizeKB: Math.round(totalBytes / 1024),
  };
  await uploadToKV('vault:meta', meta);

  console.log('═══════════════════════════════════════════════════════════');
  console.log('🎉 SINKRONISASI OBSIDIAN VAULT SELESAI!');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`✅ File Tersinkron : ${mdFiles.length} file`);
  console.log(`✅ Total Chunk     : ${allChunks.length} chunk`);
  console.log(`✅ Index KV        : vault:index`);
  console.log(`✅ Metadata KV     : vault:meta`);
  console.log('\nSekarang Dermist dapat menjawab pertanyaan berdasarkan catatan Obsidian kamu!');
  console.log('Coba di Discord: /vault status atau /ask <topik dari catatan kamu>');
}

main().catch((err) => {
  console.error('\n❌ Terjadi kesalahan saat sinkronisasi:', err.message);
  process.exit(1);
});
