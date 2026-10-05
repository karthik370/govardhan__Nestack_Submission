'use strict';

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME)
  ? '/tmp/otp_store.sqlite'
  : path.join(__dirname, '..', 'otp_store.sqlite');

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

db.exec(`
  CREATE TABLE IF NOT EXISTS otps (
    identifier    TEXT    NOT NULL PRIMARY KEY,
    code_hash     TEXT    NOT NULL,
    created_at    INTEGER NOT NULL,
    expires_at    INTEGER NOT NULL,
    used          INTEGER NOT NULL DEFAULT 0,
    attempts      INTEGER NOT NULL DEFAULT 0
  );
`);

module.exports = db;
