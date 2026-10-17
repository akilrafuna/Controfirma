/**
 * Call generator.
 *
 * Describe a situation in plain words and an open model on AMD writes a realistic
 * transcript of it. The rules then score that transcript cold.
 *
 * The generator is deliberately never shown the markers, the weights or anything
 * else about how scoring works. If it were, it would write calls built out of our
 * own keywords and the test would prove nothing. It is told a scenario the way you
 * would describe one to an actor, and nothing more.
 *
 * The useful thing this exposes: the amount is not a signal. A legitimate
 * €1,200,000,000 transfer scores near zero; a fraudulent €200 is held. What is
 * being asked for decides, not how much.
 */

import { complete, defaultModel } from './amd.js';

const SYSTEM = [
  'You write short, realistic transcripts of business telephone calls, the kind that happen',
  'in a company finance department. You are writing dialogue for a training exercise.',
  '',
  'Rules:',
  '- Between 5 and 9 lines total.',
  '- Every line starts with "CALLER:" or "STAFF:" and nothing else.',
  '- CALLER is the person who rang in. STAFF is the employee who answered.',
  '- Natural spoken language. No narration, no stage directions, no headings, no summary.',
  '- Do not label the call, do not explain it, do not say whether it is legitimate.',
  '- Output the lines and nothing else.',
].join('\n');

const INTENT = {
  legit: [
    'This call is completely legitimate. The caller is exactly who they say they are and has',
    'an ordinary, honest reason to ring. Write them behaving the way an honest person does:',
    'they are relaxed about being verified, they are happy for colleagues to be involved, and',
    'they expect the normal procedure to be followed. The amount of money involved may be very',
    'large or very small — that is irrelevant to whether the call is honest.',
  ].join(' '),
  fraud: [
    'This call is an impersonation attempt. The caller is not who they claim to be and is trying',
    'to get money moved to them. Write them the way a real social engineer behaves on the phone:',
    'plausible, polite, and working to get the payment made without anybody else looking at it.',
    'The amount of money involved may be very large or very small — a convincing attacker often',
    'asks for an unremarkable sum.',
  ].join(' '),
  auto: 'Decide for yourself whether this call is honest or an impersonation attempt, and write it convincingly either way.',
};

/** Preset scenarios. The first two are the point: amount and honesty are unrelated. */
export const PRESETS = [
  {
    label: 'Honest — but asks for €1.2 billion',
    description: 'The group treasurer calls to move 1.2 billion euros for a scheduled bond settlement that finance already knows about.',
    intent: 'legit',
    language: 'en',
  },
  {
    label: 'Fraud — but only asks for €200',
    description: 'Someone claiming to be from the IT supplier asks for a small 200 euro invoice to be paid today to a different account than usual.',
    intent: 'fraud',
    language: 'en',
  },
  {
    label: 'Fraud — cloned voice of the CEO, before a board call',
    description: "A caller sounding exactly like the CEO needs a payment made before the board meeting and doesn't want finance involved yet.",
    intent: 'fraud',
    language: 'en',
  },
  {
    label: 'Honest — angry supplier chasing a late invoice',
    description: 'A supplier rings, annoyed, because invoice 2291 is thirty days overdue and they are threatening to pause deliveries.',
    intent: 'legit',
    language: 'en',
  },
  {
    label: 'Fraud — falso avvocato, operazione riservata',
    description: "Un avvocato esterno chiama per un'acquisizione riservata e chiede un bonifico su un conto escrow prima della chiusura.",
    intent: 'fraud',
    language: 'it',
  },
  {
    label: 'Honest — il notaio per un rogito',
    description: 'Il notaio chiama per confermare il saldo da versare per il rogito di giovedì, con le coordinate già indicate nel preliminare.',
    intent: 'legit',
    language: 'it',
  },
];

/** Pull speaker-tagged lines out of whatever the model returned. */
export function parseTranscript(text) {
  const lines = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim().replace(/^[-*\d.)\s]+(?=(CALLER|STAFF|CHIAMANTE|OPERATORE)\s*:)/i, '');
    const m = line.match(/^(CALLER|STAFF|CHIAMANTE|OPERATORE)\s*:\s*(.+)$/i);
    if (!m) continue;
    const text = m[2].trim().replace(/^["“](.*)["”]$/, '$1');
    if (!text) continue;
    lines.push({
      speaker: /^(STAFF|OPERATORE)$/i.test(m[1]) ? 'staff' : 'caller',
      text,
    });
  }
  return lines;
}

/**
 * @param {string} description   the scenario, in the user's own words
 * @param {{intent?: 'legit'|'fraud'|'auto', language?: string, model?: string}} options
 */
export async function generateCall(description, options = {}) {
  const { intent = 'auto', language = 'en', model = defaultModel } = options;

  const result = await complete(
    [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content: [
          `Situation: ${description}`,
          '',
          INTENT[intent] ?? INTENT.auto,
          '',
          `Write the call in ${language === 'it' ? 'Italian' : 'English'}.`,
        ].join('\n'),
      },
    ],
    { model, temperature: 0.85, maxTokens: 700, timeoutMs: 90000 },
  );

  if (result.error) return { error: result.error, lines: [], model };

  const lines = parseTranscript(result.text);
  if (lines.length < 3) {
    return { error: 'The model did not return a usable transcript', raw: result.text, lines: [], model };
  }

  return { lines, model, latency: result.latency, intent, raw: result.text };
}
