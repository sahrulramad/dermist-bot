/**
 * AI Service — wrapper untuk Workers AI binding
 * Menggantikan direct REST API calls di cloudflare-ai.js
 */

import { TEXT_MODEL } from '../../../../shared/constants.js';

/**
 * Run AI model via Workers AI binding (lebih cepat & gratis neuron quota lebih besar)
 */
export async function runAI(ai, model, body) {
  try {
    const result = await ai.run(model, body);
    return result;
  } catch (err) {
    console.error(`[AI Error] Model: ${model}`, err.message);
    throw new Error(`Workers AI error: ${err.message}`);
  }
}

/**
 * Chat completion dengan tool calling support
 */
export async function chatCompletion(ai, { messages, tools = null }) {
  const body = { messages };
  if (tools && tools.length > 0) body.tools = tools;

  const result = await runAI(ai, TEXT_MODEL, body);
  return {
    response: result.response || '',
    toolCalls: result.tool_calls || [],
  };
}

/**
 * Simple Q&A tanpa tools
 */
export async function simpleAsk(ai, question, systemPrompt = null) {
  const defaultPrompt =
    'Kamu adalah asisten AI yang akurat dan faktual. Jawab hanya berdasarkan pertanyaan yang diberikan. JANGAN pernah mengarang informasi. Jika tidak tahu, bilang tidak tahu. Jawab singkat dan tepat.';

  const result = await runAI(ai, TEXT_MODEL, {
    messages: [
      { role: 'system', content: systemPrompt || defaultPrompt },
      { role: 'user', content: question },
    ],
  });

  return result.response || result.choices?.[0]?.message?.content || '(tidak ada jawaban)';
}

/**
 * Translate text
 */
export async function translate(ai, text, targetLang) {
  const systemPrompt = `You are a translator. Translate the user's text into ${targetLang}. Only output the translation, nothing else. Preserve meaning and tone.`;

  const result = await runAI(ai, TEXT_MODEL, {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text },
    ],
  });

  return result.response || result.choices?.[0]?.message?.content || '(gagal menerjemahkan)';
}

/**
 * Extract facts dari percakapan
 */
export async function extractFacts(ai, conversation, userName) {
  const systemPrompt = `Tugas: ekstrak FAKTA penting tentang user bernama ${userName} dari percakapan di bawah.
Format: satu fakta per baris, mulai dengan "- ".
Hanya fakta yang relevan (nama, preferensi, hobi, pekerjaan, info personal yang disebutkan).
Jangan ekstrak: opini sementara, pertanyaan, hal umum.
Jika tidak ada fakta penting, balas "TIDAK ADA".`;

  const result = await runAI(ai, TEXT_MODEL, {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: conversation },
    ],
  });

  const text = result.response || result.choices?.[0]?.message?.content || '';
  if (text.includes('TIDAK ADA')) return [];
  return text
    .split('\n')
    .map((l) => l.replace(/^-\s*/, '').trim())
    .filter((l) => l.length > 0 && l.length < 200);
}

/**
 * Content moderation check via AI
 */
export async function moderateContent(ai, text) {
  const systemPrompt = `You are a content moderation system. Analyze the following message and classify it.
Return a JSON object with:
- "safe": boolean (true if safe, false if violation)
- "categories": array of strings from ["spam", "toxic", "hate_speech", "harassment", "sexual", "violence", "self_harm", "none"]
- "severity": string from ["none", "low", "medium", "high", "critical"]
- "reason": brief explanation in Indonesian

Only output valid JSON, nothing else.`;

  const result = await runAI(ai, TEXT_MODEL, {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text },
    ],
  });

  try {
    const response = result.response || result.choices?.[0]?.message?.content || '';
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return { safe: true, categories: ['none'], severity: 'none', reason: 'Tidak terdeteksi pelanggaran' };
  } catch {
    return { safe: true, categories: ['none'], severity: 'none', reason: 'Gagal parse hasil moderasi' };
  }
}
