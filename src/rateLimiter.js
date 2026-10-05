'use strict';
const WINDOW_MS   = 10 * 60 * 1000;   
const MAX_SENDS   = 3;                

const sendLog = new Map();

function checkSendLimit(identifier) {
  const now   = Date.now();
  const entry = sendLog.get(identifier);

  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    return { allowed: true, remaining: MAX_SENDS - 1, resetAt: now + WINDOW_MS };
  }

  const remaining = MAX_SENDS - entry.count;
  return {
    allowed:   remaining > 0,
    remaining: Math.max(0, remaining - 1),
    resetAt:   entry.windowStart + WINDOW_MS,
  };
}

function recordSend(identifier) {
  const now   = Date.now();
  const entry = sendLog.get(identifier);

  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    sendLog.set(identifier, { count: 1, windowStart: now });
  } else {
    entry.count += 1;
  }
}

module.exports = { checkSendLimit, recordSend };
