/**
 * Dermist AI Agent Worker — Entry Point
 * 
 * Hono-based API yang menggantikan direct REST calls ke Cloudflare AI.
 * Bot discord.js memanggil Worker ini, bukan langsung ke CF AI API.
 * 
 * Endpoints:
 *   POST /api/chat       — Chat dengan AI agent (tool calling)
 *   POST /api/ask        — Simple Q&A tanpa tools
 *   POST /api/translate   — Translate text
 *   POST /api/moderate    — AI content moderation check
 *   POST /api/extract-facts — Extract facts dari percakapan
 *   GET  /api/health      — Health check
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { chatRoute } from './routes/chat.js';
import { askRoute } from './routes/ask.js';
import { translateRoute } from './routes/translate.js';
import { moderateRoute } from './routes/moderate.js';
import { extractFactsRoute } from './routes/extract-facts.js';
import { authMiddleware } from './middleware/auth.js';

const app = new Hono();

// ─── CORS ───
app.use('*', cors());

// ─── Auth Middleware (shared secret) ───
app.use('/api/*', authMiddleware);

// ─── Routes ───
app.route('/api/chat', chatRoute);
app.route('/api/ask', askRoute);
app.route('/api/translate', translateRoute);
app.route('/api/moderate', moderateRoute);
app.route('/api/extract-facts', extractFactsRoute);

// ─── Health Check ───
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'dermist-ai-agent',
    timestamp: new Date().toISOString(),
  });
});

// ─── 404 ───
app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404);
});

// ─── Error Handler ───
app.onError((err, c) => {
  console.error(`[ERROR] ${err.message}`, err.stack);
  return c.json({ error: 'Internal server error', message: err.message }, 500);
});

export default app;
