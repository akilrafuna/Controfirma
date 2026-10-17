/**
 * The operator console server.
 *
 *   /api/calls      the evaluation set, for the demo picker
 *   /api/score      rules only, instant, called once per spoken line
 *   /api/analyse    the full pass including AMD inference and verification
 *   /api/telemetry  live inference figures for the operator panel
 *
 * Deliberately dependency-free: at a hackathon, an npm install that fails at
 * 3am is a lost project.
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

import { TEST_CALLS } from './testcalls.js';
import { analyseCall, explainOne } from './pipeline.js';
import { scoreCall, RULES, BANDS } from './rules.js';
import { telemetrySnapshot, usingMock, listModels, defaultModel } from './amd.js';
import { generateCall, PRESETS } from './generate.js';

const PORT = process.env.PORT ?? 3000;
const PUBLIC_DIR = join(fileURLToPath(new URL('../public', import.meta.url)));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return null;
  }
}

async function serveStatic(res, urlPath) {
  const rel = normalize(urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, ''));
  if (rel.startsWith('..')) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  try {
    const file = await readFile(join(PUBLIC_DIR, rel));
    res.writeHead(200, { 'content-type': MIME[extname(rel)] ?? 'application/octet-stream' });
    res.end(file);
  } catch {
    res.writeHead(404).end('Not found');
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/api/calls') {
    return json(res, 200, {
      calls: TEST_CALLS,
      rules: RULES.map(({ id, label, weight, note }) => ({ id, label, weight, note })),
      bands: BANDS,
      mock: usingMock,
      models: await listModels(),
      defaultModel,
      presets: PRESETS,
    });
  }

  // Describe a call in plain words; an open model on AMD writes it, and the rules
  // then score it cold. The generator is never told what the rules look for.
  if (url.pathname === '/api/generate' && req.method === 'POST') {
    const body = await readBody(req);
    if (!body?.description) return json(res, 400, { error: 'description required' });
    if (usingMock) return json(res, 503, { error: 'Generating a call needs a real model. Set AMD_API_KEY.' });

    try {
      const generated = await generateCall(String(body.description).slice(0, 600), {
        intent: ['legit', 'fraud', 'auto'].includes(body.intent) ? body.intent : 'auto',
        language: body.language === 'it' ? 'it' : 'en',
        model: body.model || defaultModel,
      });
      if (generated.error) return json(res, 502, generated);
      // Score it here so the transcript and its verdict can never drift apart.
      return json(res, 200, { ...generated, finding: scoreCall(generated.lines) });
    } catch (err) {
      return json(res, 500, { error: String(err.message ?? err) });
    }
  }

  // One marker, explained on its own, so the console can show a reason while the
  // caller is still speaking instead of waiting for the call to end.
  if (url.pathname === '/api/explain' && req.method === 'POST') {
    const body = await readBody(req);
    if (!body || !Array.isArray(body.lines)) return json(res, 400, { error: 'lines[] required' });

    // Re-score server-side: the rule object carries the cited evidence spans, and
    // the client is not trusted to supply those.
    const rule = scoreCall(body.lines).firedRules.find((r) => r.id === body.ruleId);
    if (!rule) return json(res, 404, { error: `rule ${body.ruleId} has not fired on this transcript` });

    try {
      return json(res, 200, await explainOne(body.lines, rule, {
        language: body.language ?? 'en',
        model: body.model || defaultModel,
      }));
    } catch (err) {
      return json(res, 500, { error: String(err.message ?? err) });
    }
  }

  if (url.pathname === '/api/telemetry') {
    return json(res, 200, telemetrySnapshot());
  }

  if (url.pathname === '/api/score' && req.method === 'POST') {
    const body = await readBody(req);
    if (!body || !Array.isArray(body.lines)) return json(res, 400, { error: 'lines[] required' });
    return json(res, 200, scoreCall(body.lines));
  }

  if (url.pathname === '/api/analyse' && req.method === 'POST') {
    const body = await readBody(req);
    if (!body || !Array.isArray(body.lines)) return json(res, 400, { error: 'lines[] required' });
    try {
      const result = await analyseCall(body.lines, {
        language: body.language ?? 'en',
        candidatesPerRule: Math.min(body.candidatesPerRule ?? 4, 16),
        model: body.model || defaultModel,
      });
      return json(res, 200, result);
    } catch (err) {
      return json(res, 500, { error: String(err.message ?? err) });
    }
  }

  if (req.method !== 'GET') {
    return res.writeHead(405).end('Method not allowed');
  }

  return serveStatic(res, url.pathname);
});

server.listen(PORT, () => {
  console.log(`\nControfirma operator console → http://localhost:${PORT}`);
  console.log(usingMock
    ? 'inference: MOCK — set AMD_API_KEY to run on AMD\n'
    : `inference: ${telemetrySnapshot().endpoint} (${telemetrySnapshot().model})\n`);
});
