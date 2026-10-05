'use strict';
const Database = require('better-sqlite3');
const path = require('path');
const DB_PATH = path.join(__dirname, '..', 'otp_store.sqlite');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`
  CREATE TABLE IF NOT EXISTS otps (
    identifier    TEXT    NOT NULL PRIMARY KEY,
    code_hash     TEXT    NOT NULL,
    created_at    INTEGER NOT NULL,   -- Unix ms
    expires_at    INTEGER NOT NULL,   -- Unix ms
    used          INTEGER NOT NULL DEFAULT 0,  -- 0 = false, 1 = true
    attempts      INTEGER NOT NULL DEFAULT 0
  );
`);

module.exports = db;
