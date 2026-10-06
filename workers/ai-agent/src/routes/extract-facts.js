/**
 * Extract Facts Route — Ekstrak fakta dari percakapan
 * POST /api/extract-facts
 */

import { Hono } from 'hono';
import { extractFacts } from '../services/ai.js';
import { addFact } from '../services/memory.js';

const extractFactsRoute = new Hono();

extractFactsRoute.post('/', async (c) => {
  const { conversation, userName, userId, saveFacts } = await c.req.json();

  if (!conversation || !userName) {
    return c.json({ error: 'conversation and userName are required' }, 400);
  }

  try {
    const facts = await extractFacts(c.env.AI, conversation, userName);

    // Opsional: langsung simpan ke KV
    let saved = 0;
    if (saveFacts && userId && c.env.KV) {
      for (const fact of facts) {
        if (await addFact(c.env.KV, userId, userName, fact)) saved++;
      }
    }

    return c.json({ facts, saved });
  } catch (err) {
    console.error('[Extract Facts Error]', err.message);
    return c.json({ error: err.message }, 500);
  }
});

export { extractFactsRoute };
