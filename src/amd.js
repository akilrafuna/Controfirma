/**
 * The AMD inference client.
 *
 * Talks to an OpenAI-compatible endpoint, which is what both AMD Token Factory
 * and a self-hosted vLLM server on AMD Developer Cloud expose. Switching between
 * them is one environment variable, so the same code runs on a hosted Instinct
 * GPU or on our own.
 *
 * Without a key it runs a mock so the whole pipeline is demonstrable offline.
 * The mock deliberately fabricates a quote in one candidate per rule, because a
 * rejection you can see on screen is the point of the product.
 */

const BASE_URL = process.env.AMD_BASE_URL ?? 'https://developer.amd.com.cn/radeon/api/v1';
const MODEL = process.env.AMD_MODEL ?? 'Gemma-4-31B-IT';
const API_KEY = process.env.AMD_API_KEY ?? '';

/**
 * The shared event endpoint throttles hard, so fanning out unbounded loses most
 * of the batch to rate limiting. We queue instead, which keeps the parallelism
 * real but inside what the endpoint will serve. On a dedicated vLLM server on
 * AMD Developer Cloud this ceiling is ours to set, and the figure below is the
 * only thing that changes.
 */
const MAX_INFLIGHT = Number(process.env.AMD_CONCURRENCY ?? 3);
/** The shared endpoint answers 429 above roughly three requests a second. */
const MIN_INTERVAL_MS = Number(process.env.AMD_MIN_INTERVAL_MS ?? 350);
const MAX_ATTEMPTS = 5;

export const usingMock = !API_KEY;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let inflight = 0;
const waiting = [];
let nextSlotAt = 0;

/** Space request starts out, on top of the concurrency cap. */
async function rateGate() {
  const now = Date.now();
  const slot = Math.max(now, nextSlotAt);
  nextSlotAt = slot + MIN_INTERVAL_MS;
  if (slot > now) await sleep(slot - now);
}

async function acquire() {
  if (inflight < MAX_INFLIGHT) inflight += 1;
  else await new Promise((resolve) => waiting.push(resolve));
  await rateGate();
}

function release() {
  const next = waiting.shift();
  if (next) next();
  else inflight -= 1;
}

/** Rolling telemetry, surfaced in the operator panel so the AMD workload is visible. */
export const telemetry = {
  endpoint: usingMock ? 'mock (no AMD_API_KEY set)' : BASE_URL,
  model: usingMock ? 'mock' : MODEL,
  requests: 0,
  failures: 0,
  promptTokens: 0,
  completionTokens: 0,
  totalLatencyMs: 0,
  maxBatchSize: 0,
  lastBatch: null,
  // The endpoint reports cost per request, so the price of analysing one call is
  // measured rather than estimated.
  costUsd: 0,
  lastError: null,
};

function buildPrompt(rule, lines, language) {
  const transcript = lines
    .map((l, i) => `[${i}] ${l.speaker === 'caller' ? 'CALLER' : 'STAFF'}: ${l.text}`)
    .join('\n');

  const langName = language === 'it' ? 'Italian' : 'English';

  return [
    {
      role: 'system',
      content:
        'You explain why a payment call was flagged, for a finance employee who has seconds to decide. ' +
        'You do not decide anything: the decision is already made by rules. ' +
        'Rules you must obey: write at most two short sentences. ' +
        'Quote the caller at least once, inside double quotes, using their words EXACTLY as they appear in the transcript. ' +
        'Double quotes are reserved for the caller\'s exact words and nothing else: never put a rule name, ' +
        'a label or your own wording inside double quotes. ' +
        'Never invent, paraphrase or tidy up a quote. ' +
        'Never state a conclusion about whether it is fraud. ' +
        `Write in ${langName}.`,
    },
    {
      role: 'user',
      content:
        `Transcript:\n${transcript}\n\n` +
        `The rule "${rule.label.en}" was triggered. What this marker means: ${rule.note}\n\n` +
        `Explain to the employee why this specific call triggered it, quoting the caller exactly.`,
    },
  ];
}

async function callOnce(rule, lines, language, temperature, model = MODEL) {
  const started = Date.now();
  let lastError = 'unknown';

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    await acquire();
    try {
      const res = await fetch(`${BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages: buildPrompt(rule, lines, language),
          temperature,
          max_tokens: 300,
        }),
        signal: AbortSignal.timeout(60000),
      });

      if (res.status === 429 || res.status >= 500) {
        lastError = `${res.status}`;
        release();
        // Widen the gate for everyone: a 429 means the whole batch is too fast,
        // not just this request.
        nextSlotAt = Math.max(nextSlotAt, Date.now() + 400 * attempt);
        // Backoff, with jitter so a whole batch does not retry in lockstep.
        await sleep(attempt * 1500 + Math.random() * 1000);
        continue;
      }

      if (!res.ok) {
        lastError = `${res.status} ${(await res.text().catch(() => res.statusText)).slice(0, 120)}`;
        release();
        break;
      }

      const json = await res.json();
      const latency = Date.now() - started;
      release();

      telemetry.requests += 1;
      telemetry.totalLatencyMs += latency;
      telemetry.promptTokens += json.usage?.prompt_tokens ?? 0;
      telemetry.completionTokens += json.usage?.completion_tokens ?? 0;
      telemetry.costUsd += json.usage?.cost ?? 0;

      return {
        text: (json.choices?.[0]?.message?.content ?? '').trim(),
        latency,
        temperature,
        attempts: attempt,
      };
    } catch (err) {
      lastError = String(err.cause?.code ?? err.name ?? err.message ?? err);
      release();
      if (attempt < MAX_ATTEMPTS) await sleep(attempt * 1200 + Math.random() * 600);
    }
  }

  telemetry.failures += 1;
  telemetry.lastError = lastError;
  return { text: '', latency: Date.now() - started, temperature, error: lastError };
}

/** Deterministic stand-in so the pipeline is demonstrable with no credentials. */
function mockOnce(rule, lines, language, temperature, index) {
  // Quote the line that actually triggered this rule, so the stand-in reads the
  // way the real model is instructed to.
  const evidenceLine =
    rule.evidence?.[0]?.fullLine ??
    lines.filter((l) => l.speaker === 'caller')[0]?.text ??
    '';
  const clause = evidenceLine.split(/[,.;:]/).find((c) => c.trim().length > 12) ?? evidenceLine;
  const realQuote = clause.trim();

  // One candidate in each batch invents a quote, so the verifier has something
  // real to catch during a demo without a key.
  const fabricate = index === 1;
  const quote = fabricate ? 'trasferisca tutto adesso senza dirlo a nessuno' : realQuote;

  const it = `Il chiamante ha detto "${quote}". Marcatore: ${rule.label.it}.`;
  const en = `The caller said "${quote}". Marker: ${rule.label.en}.`;

  telemetry.requests += 1;
  telemetry.totalLatencyMs += 40;
  telemetry.promptTokens += 220;
  telemetry.completionTokens += 32;

  return {
    text: language === 'it' ? it : en,
    latency: 40,
    temperature,
    mock: true,
  };
}

/**
 * Generate `count` candidate explanations for one rule, all at once.
 *
 * This is the part that needs a GPU rather than an API call in a loop: a batch
 * of short completions served concurrently costs little more wall-clock time
 * than one, which is what makes generate-many-then-verify affordable.
 */
export async function explainRule(rule, lines, language, count = 4, model = MODEL) {
  const temperatures = Array.from({ length: count }, (_, i) => 0.2 + i * 0.15);
  const started = Date.now();

  const candidates = await Promise.all(
    temperatures.map((t, i) =>
      usingMock ? mockOnce(rule, lines, language, t, i) : callOnce(rule, lines, language, t, model),
    ),
  );

  const wall = Date.now() - started;
  const serial = candidates.reduce((sum, c) => sum + c.latency, 0);

  telemetry.maxBatchSize = Math.max(telemetry.maxBatchSize, count);
  telemetry.lastBatch = {
    rule: rule.id,
    size: count,
    wallMs: wall,
    serialMs: serial,
    // The mock has no real latency, so a speedup figure from it would be a lie.
    speedup: usingMock || wall === 0 ? null : +(serial / wall).toFixed(1),
  };

  return { candidates, wallMs: wall, serialMs: serial };
}

export const defaultModel = MODEL;

let modelCache = null;

/**
 * The models the endpoint actually serves. Used by the console's model picker so
 * an operator — or a judge — can watch the verifier's behaviour change with the
 * model behind it.
 */
export async function listModels() {
  if (modelCache) return modelCache;
  if (usingMock) return (modelCache = ['mock']);
  try {
    const res = await fetch(`${BASE_URL}/models`, {
      headers: { authorization: `Bearer ${API_KEY}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return [MODEL];
    const list = (await res.json()).data ?? [];
    modelCache = list.map((m) => m.id);
    return modelCache;
  } catch {
    return [MODEL];
  }
}

export function telemetrySnapshot() {
  const { requests, totalLatencyMs, promptTokens, completionTokens } = telemetry;
  return {
    ...telemetry,
    avgLatencyMs: requests ? Math.round(totalLatencyMs / requests) : 0,
    totalTokens: promptTokens + completionTokens,
  };
}
