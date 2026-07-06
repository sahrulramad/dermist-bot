import { config } from '../config.js';
import { log } from './logger.js';

const API_BASE = 'https://api.cloudflare.com/client/v4/accounts';
const TEXT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

async function runModel(model, body) {
  const url = `${API_BASE}/${config.cfAccountId}/ai/run/${model}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.cfApiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!data.success) {
    const errMsg = data.errors?.map((e) => e.message).join(', ') || 'Unknown error';
    log(`Cloudflare AI error: ${errMsg}`, 'error');
    throw new Error(`Cloudflare AI: ${errMsg}`);
  }

  return data.result;
}

export async function askAI(question, systemPrompt = null) {
  const defaultPrompt = 'Kamu adalah asisten AI yang akurat dan faktual. Jawab hanya berdasarkan pertanyaan yang diberikan. JANGAN pernah mengarang informasi tentang member server, channel, atau hal lain yang tidak kamu ketahui. Jika tidak tahu, bilang tidak tahu. Jawab singkat dan tepat.';
  const messages = [
    { role: 'system', content: systemPrompt || defaultPrompt },
    { role: 'user', content: question },
  ];

  const result = await runModel(TEXT_MODEL, { messages });
  return result.response || result.choices?.[0]?.message?.content || '(tidak ada jawaban)';
}

export async function translateText(text, targetLang) {
  const systemPrompt = `You are a translator. Translate the user's text into ${targetLang}. Only output the translation, nothing else. Preserve meaning and tone.`;
  const result = await runModel(TEXT_MODEL, {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text },
    ],
  });
  return result.response || result.choices?.[0]?.message?.content || '(gagal menerjemahkan)';
}

export async function chatReply(userMessage, userName, contextBlocks = {}) {
  const { persona = '', skills = '', facts = '', server = '', history = [] } = contextBlocks;

  const systemPrompt = `Kamu adalah Dermist, asisten AI di server Discord.${persona}${skills}${facts}${server}

Aturan penting:
- Jawab pertanyaan user dengan akurat dan faktual.
- JANGAN PERNAH mengarang informasi. Hanya gunakan data yang diberikan.
- Jika ditanya tentang server/member dan data tersedia, jawab berdasarkan data tersebut.
- Jika ditanya hal di luar data server, jawab dengan pengetahuan umum.
- Gunakan fakta yang kamu ingat untuk personalisasi jawaban.
- Jawab singkat, sopan, dan dalam bahasa yang sama dengan user.
Nama user yang bertanya: ${userName}.`;

  const messages = [{ role: 'system', content: systemPrompt }];
  for (const h of history) {
    messages.push({ role: h.role, content: h.content });
  }
  messages.push({ role: 'user', content: userMessage });

  const result = await runModel(TEXT_MODEL, { messages });
  return result.response || result.choices?.[0]?.message?.content || '(tidak ada jawaban)';
}

export async function extractFacts(conversation, userName) {
  const systemPrompt = `Tugas: ekstrak FAKTA penting tentang user bernama ${userName} dari percakapan di bawah.
Format: satu fakta per baris, mulai dengan "- ".
Hanya fakta yang relevan (nama, preferensi, hobi, pekerjaan, info personal yang disebutkan).
Jangan ekstrak: opini sementara, pertanyaan, hal umum.
Jika tidak ada fakta penting, balas "TIDAK ADA".`;

  const result = await runModel(TEXT_MODEL, {
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
