const http = require('http');

const BASE = 'http://localhost:3000/auth';

async function post(path, body) {
  return new Promise((resolve) => {
    const data = JSON.stringify(body);
    const url  = new URL(BASE + path);
    const opts = {
      hostname: url.hostname,
      port:     url.port || 80,
      path:     url.pathname,
      method:   'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };
    const req = http.request(opts, (res) => {
      let raw = '';
      res.on('data', (c) => (raw += c));
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(raw) }));
    });
    req.on('error', (e) => resolve({ status: 0, body: { error: e.message } }));
    req.write(data);
    req.end();
  });
}

function log(label, passed, r) {
  const symbol = passed ? '✔' : '✖';
  const colour = passed ? '\x1b[32m' : '\x1b[31m';
  const reset  = '\x1b[0m';
  console.log(`  ${colour}${symbol}${reset} [${r.status}] ${label}`);
  console.log(`       ${JSON.stringify(r.body)}`);
}

let capturedOTP = null;
const _origLog = console.log.bind(console);
console.log = (...args) => {
  const line = args.join(' ');
  const m = line.match(/\[OTP\].+?→\s*(\d{6})/);
  if (m) capturedOTP = m[1];
  _origLog(...args);
};

const app = require('../src/app');
const server = app.listen(3001, run);

async function run() {
  const origBase = BASE;

  async function p(path, body) {
    return new Promise((resolve) => {
      const data = JSON.stringify(body);
      const opts = {
        hostname: 'localhost',
        port:     3001,
        path:     '/auth' + path,
        method:   'POST',
        headers: {
          'Content-Type':   'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      };
      const req = http.request(opts, (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(raw) }));
      });
      req.on('error', (e) => resolve({ status: 0, body: { error: e.message } }));
      req.write(data);
      req.end();
    });
  }

  let pass = 0;
  let fail = 0;

  function assert(label, condition, r) {
    log(label, condition, r);
    if (condition) { pass++; }
    else { fail++; console.log(`    !! ASSERTION FAILED`); }
  }

  console.log('  OTP Auth — Security Test Suite');

  console.log('── 1. Send OTP (happy path)');
  capturedOTP = null;
  const s1 = await p('/send', { identifier: 'tester@example.com' });
  assert('send returns 200', s1.status === 200, s1);
  assert('OTP was printed to console (CSPRNG working)', capturedOTP !== null, { status: capturedOTP ? 200 : 500, body: { otp: capturedOTP } });
  const goodCode = capturedOTP;

  console.log('\n── 2. Wrong code (1st attempt)');
  const w1 = await p('/verify', { identifier: 'tester@example.com', code: '000000' });
  assert('wrong code → 400', w1.status === 400, w1);
  assert('attempts_remaining = 4', w1.body.attempts_remaining === 4, w1);
  console.log('\n── 3. Exhaust brute-force limit (4 more wrong codes)');
  let lastWrong;
  for (let i = 0; i < 4; i++) {
    lastWrong = await p('/verify', { identifier: 'tester@example.com', code: '111111' });
  }
  assert('5th wrong → 429', lastWrong.status === 429, lastWrong);
  console.log('\n── 4. Correct code after lock is still rejected');
  const lockedCorrect = await p('/verify', { identifier: 'tester@example.com', code: goodCode });
  assert('correct code after lock → 429', lockedCorrect.status === 429, lockedCorrect);
  console.log('\n── 5. Send rate limit (3 sends already used for tester@)');
  await p('/send', { identifier: 'tester@example.com' });
  await p('/send', { identifier: 'tester@example.com' });
  const rateHit = await p('/send', { identifier: 'tester@example.com' });
  assert('4th send → 429', rateHit.status === 429, rateHit);

  console.log('\n── 6. Successful verify then reuse');
  capturedOTP = null;
  await p('/send', { identifier: 'new@example.com' });
  const freshCode = capturedOTP;

  const good = await p('/verify', { identifier: 'new@example.com', code: freshCode });
  assert('correct code → 200', good.status === 200, good);
  assert('session_token present', typeof good.body.session_token === 'string' && good.body.session_token.length > 10, good);

  const reuse = await p('/verify', { identifier: 'new@example.com', code: freshCode });
  assert('same code reused → 400', reuse.status === 400, reuse);

  
  console.log('\n── 7. Bad request — missing identifier');
  const bad = await p('/send', {});
  assert('missing identifier → 400', bad.status === 400, bad);
  console.log('\n══════════════════════════════════════════');
  console.log(`  Results: ${pass} passed, ${fail} failed`);
  console.log('══════════════════════════════════════════\n');

  server.close();
  process.exit(fail > 0 ? 1 : 0);
}
