/**
 * The verifier.
 *
 * Every explanation the model produces is checked here before an operator is
 * allowed to see it. The check is mechanical: each quoted span must appear
 * verbatim in what the caller actually said. A model that tidies up a quote, or
 * invents one outright, is rejected and the reason is shown.
 *
 * This is the only reason the product can be trusted in front of money.
 */

/** Collapse the differences that are not meaningful, keep the ones that are. */
function normalise(text) {
  return text
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Pull every double-quoted span out of the explanation. */
function extractQuotes(text) {
  const quotes = [];
  for (const match of text.matchAll(/"([^"]{3,})"/g)) {
    quotes.push(match[1].trim());
  }
  return quotes;
}

const MAX_SENTENCES = 3;
const MAX_CHARS = 400;

/** Words that would mean the model had started deciding instead of explaining. */
const VERDICT_WORDS =
  /\b(?:is\s+(?:definitely\s+)?(?:a\s+)?(?:fraud|scam|fraudulent)|è\s+(?:sicuramente\s+)?una\s+(?:truffa|frode)|block\s+the\s+payment|blocchi\s+il\s+(?:pagamento|bonifico)|do\s+not\s+pay|non\s+paghi)\b/iu;

/**
 * @param {string} explanation   what the model produced
 * @param {{speaker: string, text: string}[]} lines   the transcript
 * @returns {{ok: boolean, reason?: string, quotes: string[], badQuote?: string}}
 */
export function verifyExplanation(explanation, lines) {
  const quotes = extractQuotes(explanation);

  if (!explanation) {
    return { ok: false, reason: 'Empty response', quotes };
  }

  if (explanation.length > MAX_CHARS) {
    return { ok: false, reason: `Too long for a live call (${explanation.length} chars)`, quotes };
  }

  const sentences = explanation.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length > MAX_SENTENCES) {
    return { ok: false, reason: `${sentences.length} sentences, operator has seconds`, quotes };
  }

  if (VERDICT_WORDS.test(explanation)) {
    return { ok: false, reason: 'Model stated a verdict; only the rules and the human may decide', quotes };
  }

  if (quotes.length === 0) {
    return { ok: false, reason: 'No quote from the caller, so nothing can be checked', quotes };
  }

  // The actual gate. Only the caller's own words count as a source.
  const callerText = normalise(lines.filter((l) => l.speaker === 'caller').map((l) => l.text).join(' '));

  for (const quote of quotes) {
    if (!callerText.includes(normalise(quote))) {
      return {
        ok: false,
        reason: 'Quote does not appear in the transcript',
        badQuote: quote,
        quotes,
      };
    }
  }

  return { ok: true, quotes };
}

/**
 * Verify a whole batch and pick a winner.
 *
 * Preference goes to the shortest surviving explanation: on a live call, brevity
 * is the feature. Rejected candidates are kept so the operator, and the judges,
 * can see what was thrown away and why.
 */
export function selectVerified(candidates, lines) {
  // A request that never came back is an infrastructure failure, not a rejected
  // explanation. Counting it as a rejection would inflate the one number this
  // product is judged on.
  const failed = candidates.filter((c) => c.error);
  const returned = candidates.filter((c) => !c.error);

  const checked = returned.map((candidate) => ({
    ...candidate,
    verification: verifyExplanation(candidate.text, lines),
  }));

  const passed = checked.filter((c) => c.verification.ok);
  const rejected = checked.filter((c) => !c.verification.ok);

  passed.sort((a, b) => a.text.length - b.text.length);

  return {
    winner: passed[0] ?? null,
    passed,
    rejected,
    failed,
    generated: checked.length,
  };
}
