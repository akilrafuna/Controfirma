/**
 * Model benchmark.
 *
 *   node --env-file-if-exists=.env src/benchmark.js
 *
 * On a live call the operator has seconds, so the model choice is a latency
 * decision as much as a quality one. This runs the real task against each
 * candidate and reports what actually matters: did it answer at all, how fast,
 * did it quote the caller verbatim, and what did it cost.
 */

import { RULES } from './rules.js';
import { TEST_CALLS } from './testcalls.js';
import { verifyExplanation } from './verify.js';

const BASE_URL = process.env.AMD_BASE_URL;
const API_KEY = process.env.AMD_API_KEY;

const MODELS = [
  'Qwen3.8-Flash-Next',
  'DeepSeek-V4.1-Flash',
  'GLM-5.3-Flash',
  'Gemma-4-31B-IT',
  'Qwen3.8-27B',
  'MiniCPM5-2B',
];

const call = TEST_CALLS[0];                                  // the false-lawyer call
const rule = RULES.find((r) => r.id === 'SECRECY');
const transcript = call.lines
  .map((l, i) => `[${i}] ${l.speaker === 'caller' ? 'CALLER' : 'STAFF'}: ${l.text}`)
  .join('\n');

const messages = [
  {
    role: 'system',
    content:
      'You explain why a payment call was flagged, for a finance employee who has seconds to decide. ' +
      'You do not decide anything: the decision is already made by rules. ' +
      'Rules you must obey: write at most two short sentences. ' +
      'Quote the caller at least once, inside double quotes, using their words EXACTLY as they appear in the transcript. ' +
      "Double quotes are reserved for the caller's exact words and nothing else: never put a rule name, " +
      'a label or your own wording inside double quotes. ' +
      'Never invent, paraphrase or tidy up a quote. ' +
      'Never state a conclusion about whether it is fraud. ' +
      'Write in Italian.',
  },
  {
    role: 'user',
    content:
      `Transcript:\n${transcript}\n\n` +
      `The rule "${rule.label.en}" was triggered. What this marker means: ${rule.note}\n\n` +
      `Explain to the employee why this specific call triggered it, quoting the caller exactly.`,
  },
];

console.log(`\ntask: explain the ${rule.id} marker on "${call.title}", in Italian`);
console.log(`budget: 400 max_tokens\n`);
console.log(
  'model'.padEnd(23) + 'ms'.padStart(7) + 'out'.padStart(6) + 'think'.padStart(7) + '  €/1k calls  verified',
);
console.log('-'.repeat(78));

const rows = [];

for (const model of MODELS) {
  const started = Date.now();
  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model, messages, temperature: 0.3, max_tokens: 400 }),
      signal: AbortSignal.timeout(90000),
    });
    const ms = Date.now() - started;

    if (!res.ok) {
      console.log(model.padEnd(23) + String(ms).padStart(7) + `  HTTP ${res.status}`);
      continue;
    }

    const json = await res.json();
    const text = (json.choices?.[0]?.message?.content ?? '').trim();
    const usage = json.usage ?? {};
    const reasoning = usage.completion_tokens_details?.reasoning_tokens ?? 0;
    const cost = usage.cost ?? 0;
    const check = verifyExplanation(text, call.lines);

    rows.push({ model, ms, text, check, cost });

    console.log(
      model.padEnd(23) +
        String(ms).padStart(7) +
        String(usage.completion_tokens ?? 0).padStart(6) +
        String(reasoning).padStart(7) +
        '  ' + (cost * 1000).toFixed(3).padStart(9) +
        '  ' + (check.ok ? 'yes' : `no — ${check.reason}`),
    );
  } catch (err) {
    console.log(model.padEnd(23) + '      —  ' + String(err.cause?.code ?? err.name));
  }
}

console.log('\n\nWhat each one actually wrote:\n');
for (const r of rows) {
  console.log(`── ${r.model}  (${r.ms} ms)`);
  console.log(`   ${r.text || '(empty)'}`);
  if (!r.check.ok) console.log(`   REJECTED: ${r.check.reason}${r.check.badQuote ? ` — "${r.check.badQuote}"` : ''}`);
  console.log();
}

const usable = rows.filter((r) => r.check.ok).sort((a, b) => a.ms - b.ms);
if (usable.length) {
  console.log(`Fastest model that passed verification: ${usable[0].model} at ${usable[0].ms} ms`);
} else {
  console.log('No model passed verification on this task — the prompt needs tightening.');
}
