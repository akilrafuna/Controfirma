/**
 * Connectivity probe.
 *
 *   node --env-file-if-exists=.env src/probe.js
 *
 * Lists the models the configured endpoint actually serves, then sends one tiny
 * completion. Run this before anything else when the endpoint changes: it is far
 * easier to read than a failure buried in the pipeline.
 */

const BASE_URL = process.env.AMD_BASE_URL ?? '';
const API_KEY = process.env.AMD_API_KEY ?? '';
const MODEL = process.env.AMD_MODEL ?? '';

if (!API_KEY) {
  console.error('No AMD_API_KEY. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

console.log(`endpoint  ${BASE_URL}`);
console.log(`key       ${API_KEY.slice(0, 5)}…${API_KEY.slice(-4)} (${API_KEY.length} chars)`);
console.log(`model     ${MODEL}\n`);

async function probe(path, init) {
  const url = `${BASE_URL}${path}`;
  try {
    const res = await fetch(url, {
      ...init,
      headers: { authorization: `Bearer ${API_KEY}`, 'content-type': 'application/json', ...(init?.headers ?? {}) },
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  } catch (err) {
    return { ok: false, status: 0, text: String(err.cause?.code ?? err.message ?? err) };
  }
}

console.log('→ GET /models');
const models = await probe('/models');
if (models.ok) {
  try {
    const list = JSON.parse(models.text).data ?? [];
    console.log(`  ${list.length} model(s) served:`);
    for (const m of list.slice(0, 40)) console.log(`    ${m.id}`);
  } catch {
    console.log(`  ${models.text.slice(0, 400)}`);
  }
} else {
  console.log(`  FAILED ${models.status} ${models.text.slice(0, 300)}`);
}

console.log('\n→ POST /chat/completions');
const chat = await probe('/chat/completions', {
  method: 'POST',
  body: JSON.stringify({
    model: MODEL,
    messages: [{ role: 'user', content: 'Reply with exactly: ok' }],
    max_tokens: 10,
  }),
});
if (chat.ok) {
  const json = JSON.parse(chat.text);
  console.log(`  reply: ${JSON.stringify(json.choices?.[0]?.message?.content)}`);
  console.log(`  usage: ${JSON.stringify(json.usage ?? {})}`);
  console.log('\nEndpoint is live. Run: node --env-file-if-exists=.env src/eval.js');
} else {
  console.log(`  FAILED ${chat.status} ${chat.text.slice(0, 500)}`);
}
