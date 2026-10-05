'use strict';

const crypto = require('crypto');
const bcrypt = require('bcrypt');

const BCRYPT_ROUNDS = 10;


function generateOTP() {
  const raw = crypto.randomInt(0, 1_000_000);
  return String(raw).padStart(6, '0');
}

async function hashOTP(otp) {
  return bcrypt.hash(otp, BCRYPT_ROUNDS);
}
async function verifyOTP(candidate, storedHash) {
  return bcrypt.compare(candidate, storedHash);
}
function generateSessionToken() {
  return crypto.randomBytes(32).toString('base64url');
}

module.exports = { generateOTP, hashOTP, verifyOTP, generateSessionToken };
