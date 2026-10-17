/**
 * Generated-call test.
 *
 *   node --env-file-if-exists=.env src/gentest.js
 *
 * Runs every preset scenario through the generator and scores the result cold.
 * The generator is never told what the rules look for, so this is a blind test
 * rather than a rehearsal.
 *
 * What it is really checking: that the amount of money is not a signal. An honest
 * €1.2 billion transfer should stay LOW; a fraudulent €200 should be HELD.
 */

import { PRESETS, generateCall } from './generate.js';
import { scoreCall } from './rules.js';
import { telemetrySnapshot } from './amd.js';

const FLAGGED = new Set(['HOLD', 'REVIEW']);
let right = 0;

for (const preset of PRESETS) {
  console.log(`\n${'─'.repeat(78)}\n${preset.label}`);
  console.log(`  scenario: ${preset.description}`);

  const generated = await generateCall(preset.description, {
    intent: preset.intent,
    language: preset.language,
  });

  if (generated.error) {
    console.log(`  GENERATION FAILED: ${generated.error}`);
    continue;
  }

  const finding = scoreCall(generated.lines);
  const flagged = FLAGGED.has(finding.level);
  const correct = preset.intent === 'fraud' ? flagged : !flagged;
  if (correct) right += 1;

  console.log('');
  for (const line of generated.lines) {
    console.log(`  ${line.speaker === 'caller' ? 'CALLER' : 'STAFF '} | ${line.text}`);
  }
  console.log(`\n  → ${finding.total} ${finding.level}  ${correct ? 'correct' : '*** WRONG ***'}`);
  console.log(`     markers: ${finding.firedRules.map((r) => r.id).join(', ') || 'none'}`);
}

const t = telemetrySnapshot();
console.log(`\n${'─'.repeat(78)}`);
console.log(`${right} of ${PRESETS.length} generated calls classified correctly`);
console.log(`model ${t.model} · ${t.requests} requests · $${t.costUsd.toFixed(5)}\n`);
