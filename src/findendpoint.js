/**
 * Endpoint finder.
 *
 *   node --env-file-if-exists=.env src/findendpoint.js
 *
 * The hackathon portal hands out a key without always making the base URL
 * obvious. This tries the plausible hosts and reports which one answers, so the
 * right value can go into .env.
 */

const API_KEY = process.env.AMD_API_KEY ?? '';

const CANDIDATES = [
  'https://developer.amd.com.cn/radeon/api/v1',
  'https://developer.amd.com/radeon/api/v1',
  'https://notebooks.amd.com/tokenfactory/api/v1',
  'https://notebooks.amd.com/api/v1',
  'https://api.tokenfactory.amd.com/v1',
  'https://tokenfactory.amd.com/api/v1',
  'https://api.radeon.amd.com/v1',
];

if (!API_KEY) {
  console.error('No AMD_API_KEY set.');
  process.exit(1);
}

for (const base of CANDIDATES) {
  process.stdout.write(`${base.padEnd(48)} `);
  try {
    const res = await fetch(`${base}/models`, {
      headers: { authorization: `Bearer ${API_KEY}` },
      signal: AbortSignal.timeout(12000),
    });
    const body = await res.text();

    if (res.ok) {
      console.log(`200 OK`);
      try {
        const list = JSON.parse(body).data ?? [];
        console.log(`\n  ${list.length} model(s):`);
        for (const m of list) console.log(`    ${m.id}`);
        console.log(`\n  Put this in .env:  AMD_BASE_URL=${base}\n`);
      } catch {
        console.log(`  ${body.slice(0, 300)}`);
      }
      break;
    }
    // A 401/403 still means the host exists and speaks the protocol.
    console.log(`${res.status} ${body.slice(0, 90).replace(/\s+/g, ' ')}`);
  } catch (err) {
    console.log(String(err.cause?.code ?? err.name ?? err.message));
  }
}
