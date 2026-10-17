/**
 * Orchestration, in the order that matters:
 *
 *   1. rules score the call            (deterministic, no model)
 *   2. the model drafts explanations   (many at once, on AMD)
 *   3. the verifier throws away any explanation it cannot source
 *   4. a human decides
 *
 * Step 4 is not in this file, and that is deliberate. Nothing here moves money
 * or blocks a payment.
 */

import { scoreCall, scoreProgressive } from './rules.js';
import { explainRule, telemetrySnapshot, defaultModel } from './amd.js';
import { selectVerified } from './verify.js';

/** Shape one rule's batch into what the console renders. */
function shapeExplanation(rule, selection, wallMs, serialMs, model) {
  return {
    ruleId: rule.id,
    label: rule.label,
    weight: rule.weight,
    note: rule.note,
    evidence: rule.evidence,
    model,
    text: selection.winner?.text ?? null,
    // When every candidate fails verification we say so rather than showing the
    // operator something unsourced.
    unexplained: !selection.winner,
    generated: selection.generated,
    passed: selection.passed.length,
    failed: selection.failed.length,
    rejected: selection.rejected.map((r) => ({
      text: r.text,
      reason: r.verification.reason,
      badQuote: r.verification.badQuote ?? null,
    })),
    wallMs,
    serialMs,
  };
}

/**
 * Explain a single marker.
 *
 * The console calls this the moment a rule fires rather than waiting for the
 * call to end, so the operator reads the reason while the caller is still
 * talking — which is the only time it is any use.
 */
export async function explainOne(lines, rule, options = {}) {
  const { language = 'en', candidatesPerRule = 4, model = defaultModel } = options;
  const { candidates, wallMs, serialMs } = await explainRule(rule, lines, language, candidatesPerRule, model);
  const selection = selectVerified(candidates, lines);
  return {
    ...shapeExplanation(rule, selection, wallMs, serialMs, model),
    telemetry: telemetrySnapshot(),
  };
}

/**
 * Analyse a complete call.
 *
 * @param {{speaker: string, text: string}[]} lines
 * @param {{language?: string, candidatesPerRule?: number, explain?: boolean}} options
 */
export async function analyseCall(lines, options = {}) {
  // An operator mid-call reads the top reasons, not all of them. Capping the
  // explained markers keeps the screen readable and the request count sane on a
  // shared endpoint; every marker is still scored, shown and cited regardless.
  const { language = 'en', candidatesPerRule = 4, explain = true, explainTop = 3, model = defaultModel } = options;

  const finding = scoreCall(lines);

  // Nothing fired: no explanation needed, and no reason to spend a GPU on it.
  if (!explain || finding.firedRules.length === 0) {
    return {
      ...finding,
      explanations: [],
      verification: { generated: 0, rejected: 0, rejectionReasons: [] },
      telemetry: telemetrySnapshot(),
    };
  }

  // Every fired rule is explained concurrently, and each rule's explanation is
  // itself a concurrent batch. One call therefore becomes firedRules × candidates
  // short completions in flight at once.
  const explanations = await Promise.all(
    finding.firedRules.slice(0, explainTop).map(async (rule) => {
      const { candidates, wallMs, serialMs } = await explainRule(rule, lines, language, candidatesPerRule, model);
      return shapeExplanation(rule, selectVerified(candidates, lines), wallMs, serialMs, model);
    }),
  );

  const rejected = explanations.flatMap((e) => e.rejected);

  return {
    ...finding,
    explanations,
    verification: {
      generated: explanations.reduce((n, e) => n + e.generated, 0),
      passed: explanations.reduce((n, e) => n + e.passed, 0),
      failed: explanations.reduce((n, e) => n + e.failed, 0),
      rejected: rejected.length,
      rejectionReasons: rejected.map((r) => r.reason),
      fabricatedQuotes: rejected.filter((r) => r.badQuote).map((r) => r.badQuote),
    },
    telemetry: telemetrySnapshot(),
  };
}

/** Risk as it climbs line by line, for the live view during a call. */
export function analyseProgressive(lines) {
  return scoreProgressive(lines);
}
