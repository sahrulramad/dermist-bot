/**
 * Ask Route — Simple Q&A tanpa tools
 * POST /api/ask
 */

import { Hono } from 'hono';
import { simpleAsk } from '../services/ai.js';

const askRoute = new Hono();

askRoute.post('/', async (c) => {
  const { question, systemPrompt } = await c.req.json();

  if (!question) {
    return c.json({ error: 'question is required' }, 400);
  }

  try {
    const answer = await simpleAsk(c.env.AI, question, systemPrompt);
    return c.json({ answer });
  } catch (err) {
    console.error('[Ask Error]', err.message);
    return c.json({ error: err.message }, 500);
  }
});

export { askRoute };
