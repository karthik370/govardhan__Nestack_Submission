'use strict';

const db                = require('./db');
const { checkSendLimit, recordSend } = require('./rateLimiter');
const {
  generateOTP,
  hashOTP,
  verifyOTP,
  generateSessionToken,
} = require('./crypto');

const OTP_TTL_MS      = 10 * 60 * 1000;  
const MAX_ATTEMPTS    = 5;                

const stmtUpsertOTP = db.prepare(`
  INSERT INTO otps (identifier, code_hash, created_at, expires_at, used, attempts)
  VALUES (@identifier, @codeHash, @createdAt, @expiresAt, 0, 0)
  ON CONFLICT(identifier) DO UPDATE SET
    code_hash  = excluded.code_hash,
    created_at = excluded.created_at,
    expires_at = excluded.expires_at,
    used       = 0,
    attempts   = 0
`);

const stmtGetOTP = db.prepare(`
  SELECT * FROM otps WHERE identifier = ?
`);

const stmtIncrementAttempts = db.prepare(`
  UPDATE otps SET attempts = attempts + 1 WHERE identifier = ?
`);

const stmtMarkUsed = db.prepare(`
  UPDATE otps SET used = 1 WHERE identifier = ?
`);

async function sendOTP(req, res) {
  const { identifier } = req.body;

  if (!identifier || typeof identifier !== 'string' || identifier.trim() === '') {
    return res.status(400).json({ message: 'identifier is required (email or phone).' });
  }

  const id = identifier.trim().toLowerCase();

  const limit = checkSendLimit(id);
  if (!limit.allowed) {
    const retryAfterSec = Math.ceil((limit.resetAt - Date.now()) / 1000);
    res.setHeader('Retry-After', retryAfterSec);
    return res.status(429).json({
      message:       'Too many OTP requests. Try again later.',
      retry_after_s: retryAfterSec,
    });
  }
  const otp      = generateOTP();
  const codeHash = await hashOTP(otp);
  const now      = Date.now();

  stmtUpsertOTP.run({
    identifier: id,
    codeHash,
    createdAt:  now,
    expiresAt:  now + OTP_TTL_MS,
  });

  recordSend(id);

  console.log(`[OTP] ${id} → ${otp}`);

  return res.status(200).json({ message: `OTP sent to ${identifier}` });
}


async function verifyOTPHandler(req, res) {
  const { identifier, code } = req.body;

  if (!identifier || typeof identifier !== 'string' || identifier.trim() === '') {
    return res.status(400).json({ message: 'identifier is required.' });
  }

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ message: 'code is required.' });
  }

  const id  = identifier.trim().toLowerCase();
  const now = Date.now();

  const record = stmtGetOTP.get(id);

  if (!record) {
    return res.status(400).json({ message: 'No OTP found. Please request a new code.' });
  }
  if (now > record.expires_at) {
    return res.status(400).json({ message: 'OTP has expired. Please request a new code.' });
  }
  if (record.used === 1) {
    return res.status(400).json({ message: 'This OTP has already been used.' });
  }
  if (record.attempts >= MAX_ATTEMPTS) {
    return res.status(429).json({
      message:           'OTP locked after too many failed attempts. Request a new code.',
      attempts_remaining: 0,
    });
  }
  const match = await verifyOTP(code, record.code_hash);

  if (!match) {
    stmtIncrementAttempts.run(id);

    const updated        = stmtGetOTP.get(id);
    const attemptsUsed   = updated.attempts;
    const attemptsLeft   = Math.max(0, MAX_ATTEMPTS - attemptsUsed);

    if (attemptsLeft === 0) {
      return res.status(429).json({
        message:           'Too many incorrect attempts. OTP is now locked. Request a new code.',
        attempts_remaining: 0,
      });
    }

    return res.status(400).json({
      message:           'Invalid or expired code.',
      attempts_remaining: attemptsLeft,
    });
  }

  stmtMarkUsed.run(id);

  const sessionToken = generateSessionToken();

  return res.status(200).json({
    message:       'Verified',
    session_token: sessionToken,
  });
}

module.exports = { sendOTP, verifyOTPHandler };
