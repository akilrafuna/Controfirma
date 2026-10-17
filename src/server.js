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
import { analyseCall } from './pipeline.js';
import { scoreCall, RULES, BANDS } from './rules.js';
import { telemetrySnapshot, usingMock } from './amd.js';

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
    });
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
        candidatesPerRule: Math.min(body.candidatesPerRule ?? 6, 16),
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
