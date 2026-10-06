/**
 * Worker Client — utility di bot untuk memanggil Cloudflare Workers
 * Menggantikan direct REST API calls ke Cloudflare AI
 */

import { config } from '../config.js';
import { log } from './logger.js';

const WORKER_BASE_URL = config.workerBaseUrl;
const AUTH_SECRET = config.workerAuthSecret;

async function workerFetch(path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (AUTH_SECRET) headers['Authorization'] = `Bearer ${AUTH_SECRET}`;

  const res = await fetch(`${WORKER_BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Worker error (${res.status}): ${errText}`);
  }

  return res.json();
}

/**
 * Chat dengan AI Agent (tool calling support)
 * Menggantikan runAgent() yang langsung panggil CF AI API
 */
export async function workerChat({ userMessage, userName, userId, serverContext, persona, skills, triggerReason }) {
  try {
    return await workerFetch('/api/chat', {
      userMessage,
      userName,
      userId,
      serverContext,
      persona,
      skills,
      triggerReason,
    });
  } catch (err) {
    log(`Worker chat error: ${err.message}`, 'error');
    // Fallback ke direct API jika Worker down
    return { reply: null, toolCalls: [], error: err.message };
  }
}

/**
 * Simple Q&A — menggantikan askAI()
 */
export async function workerAsk(question, systemPrompt = null) {
  try {
    const data = await workerFetch('/api/ask', { question, systemPrompt });
    return data.answer;
  } catch (err) {
    log(`Worker ask error: ${err.message}`, 'error');
    return '(gagal menghubungi AI Worker)';
  }
}

/**
 * Translate — menggantikan translateText()
 */
export async function workerTranslate(text, targetLang) {
  try {
    const data = await workerFetch('/api/translate', { text, targetLang });
    return data.translation;
  } catch (err) {
    log(`Worker translate error: ${err.message}`, 'error');
    return '(gagal menerjemahkan)';
  }
}

/**
 * Content moderation — panggil AI moderation
 */
export async function workerModerate(text) {
  try {
    return await workerFetch('/api/moderate', { text });
  } catch (err) {
    log(`Worker moderate error: ${err.message}`, 'error');
    return { safe: true, categories: ['none'], severity: 'none', reason: 'Worker unreachable' };
  }
}

/**
 * Extract facts — menggantikan extractFacts()
 */
export async function workerExtractFacts(conversation, userName, userId, saveFacts = true) {
  try {
    const data = await workerFetch('/api/extract-facts', { conversation, userName, userId, saveFacts });
    return data.facts;
  } catch (err) {
    log(`Worker extract facts error: ${err.message}`, 'error');
    return [];
  }
}

/**
 * Health check Worker
 */
export async function workerHealthCheck() {
  try {
    const res = await fetch(`${WORKER_BASE_URL}/api/health`);
    return res.ok;
  } catch {
    return false;
  }
}
