/**
 * The evaluation run.
 *
 * Prints the two numbers that decide whether this product is usable: how many
 * fraudulent calls were held, and how many genuine calls were disturbed. A tool
 * that flags the real CFO is worse than no tool, because it gets switched off.
 *
 *   node src/eval.js
 */

import { TEST_CALLS } from './testcalls.js';
import { analyseCall } from './pipeline.js';
import { usingMock, telemetrySnapshot } from './amd.js';

const FLAGGED = new Set(['HOLD', 'REVIEW']);

function pad(s, n) {
  s = String(s);
  return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length);
}

const results = [];

for (const call of TEST_CALLS) {
  const result = await analyseCall(call.lines, { language: call.language });
  results.push({ call, result });
}

console.log('\nCONTROFIRMA — evaluation');
console.log(usingMock ? 'inference: MOCK (no AMD_API_KEY set)\n' : `inference: ${telemetrySnapshot().endpoint}\n`);

console.log(pad('call', 30) + pad('truth', 8) + pad('score', 7) + pad('level', 9) + 'markers');
console.log('-'.repeat(84));

for (const { call, result } of results) {
  const flagged = FLAGGED.has(result.level);
  const correct = call.expected === 'fraud' ? flagged : !flagged;
  console.log(
    pad(call.id, 30) +
      pad(call.expected, 8) +
      pad(result.total, 7) +
      pad(result.level, 9) +
      (result.firedRules.map((r) => r.id).join(', ') || '—') +
      (correct ? '' : '   <-- WRONG'),
  );
}

const frauds = results.filter((r) => r.call.expected === 'fraud');
const legits = results.filter((r) => r.call.expected === 'legit');

const caught = frauds.filter((r) => FLAGGED.has(r.result.level));
const held = frauds.filter((r) => r.result.level === 'HOLD');
const falseAlarms = legits.filter((r) => FLAGGED.has(r.result.level));

const generated = results.reduce((n, r) => n + r.result.verification.generated, 0);
const rejectedCount = results.reduce((n, r) => n + (r.result.verification.rejected ?? 0), 0);
const fabricated = results.flatMap((r) => r.result.verification.fabricatedQuotes ?? []);

console.log('\nDETECTION');
console.log(`  fraudulent calls flagged     ${caught.length} of ${frauds.length}`);
console.log(`  of those, held outright      ${held.length}`);
console.log(`  genuine calls disturbed      ${falseAlarms.length} of ${legits.length}`);

const failedCount = results.reduce((n, r) => n + (r.result.verification.failed ?? 0), 0);

console.log('\nVERIFICATION');
console.log(`  explanations returned        ${generated}`);
console.log(`  rejected before display      ${rejectedCount}`);
console.log(`  fabricated quotes caught     ${fabricated.length}`);
if (generated) {
  console.log(`  share rejected               ${Math.round((rejectedCount / generated) * 100)}%`);
}
if (failedCount) {
  console.log(`  requests that never returned ${failedCount}  (infrastructure, not counted above)`);
  console.log(`  last failure                 ${telemetrySnapshot().lastError}`);
}

const t = telemetrySnapshot();
console.log('\nINFERENCE');
console.log(`  model                        ${t.model}`);
console.log(`  requests                     ${t.requests}  (failures: ${t.failures})`);
console.log(`  largest parallel batch       ${t.maxBatchSize}`);
console.log(`  mean latency                 ${t.avgLatencyMs} ms`);
console.log(`  tokens                       ${t.totalTokens}`);
if (t.costUsd > 0) {
  console.log(`  total cost                   $${t.costUsd.toFixed(5)}`);
  console.log(`  cost per call analysed       $${(t.costUsd / results.length).toFixed(5)}`);
  console.log(`  cost per 1,000 calls         $${((t.costUsd / results.length) * 1000).toFixed(2)}`);
}
if (t.lastBatch) {
  const speedup = t.lastBatch.speedup ? ` (${t.lastBatch.speedup}x)` : ' (mock: no real latency to compare)';
  console.log(`  last batch                   ${t.lastBatch.size} at once, ${t.lastBatch.wallMs} ms wall vs ${t.lastBatch.serialMs} ms serial${speedup}`);
}

const wrong = results.filter(({ call, result }) =>
  call.expected === 'fraud' ? !FLAGGED.has(result.level) : FLAGGED.has(result.level),
);
console.log(wrong.length === 0 ? '\nAll calls classified correctly.\n' : `\n${wrong.length} misclassified.\n`);
