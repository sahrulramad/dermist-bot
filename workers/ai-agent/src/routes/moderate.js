/**
 * Moderate Route — AI content moderation
 * POST /api/moderate
 */

import { Hono } from 'hono';
import { moderateContent } from '../services/ai.js';

const moderateRoute = new Hono();

moderateRoute.post('/', async (c) => {
  const { text } = await c.req.json();

  if (!text) {
    return c.json({ error: 'text is required' }, 400);
  }

  try {
    const result = await moderateContent(c.env.AI, text);
    return c.json(result);
  } catch (err) {
    console.error('[Moderate Error]', err.message);
    return c.json({ error: err.message }, 500);
  }
});

export { moderateRoute };
