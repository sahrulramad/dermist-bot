/**
 * Translate Route — Translate text via AI
 * POST /api/translate
 */

import { Hono } from 'hono';
import { translate } from '../services/ai.js';

const translateRoute = new Hono();

translateRoute.post('/', async (c) => {
  const { text, targetLang } = await c.req.json();

  if (!text || !targetLang) {
    return c.json({ error: 'text and targetLang are required' }, 400);
  }

  try {
    const result = await translate(c.env.AI, text, targetLang);
    return c.json({ translation: result });
  } catch (err) {
    console.error('[Translate Error]', err.message);
    return c.json({ error: err.message }, 500);
  }
});

export { translateRoute };
