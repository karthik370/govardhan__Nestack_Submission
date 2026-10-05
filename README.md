# Abuse-Resistant OTP System:

### 1. Install & Run
```bash
npm install
npm start
```
The server will run on `http://localhost:3000`. You can also open this URL in your browser to test it via a minimal UI.

### 2. Run Tests
```bash
npm test
```
Runs the test suite checking all rate limits, locking, expiry, and single-use rules.

> **Note on OTP delivery:** Since third-party SMS/email services aren't wired up, generated codes are printed directly to the terminal where the server is running (e.g., `[OTP] user@example.com → 482910`).

---

## API Endpoints

### 1. Request OTP
- **`POST /auth/send`**
- Body: `{ "identifier": "user@example.com" }`
- Responses:
  - `200`: OTP generated & logged to console
  - `429`: Limit reached (max 3 sends per 10 minutes)

### 2. Verify OTP
- **`POST /auth/verify`**
- Body: `{ "identifier": "user@example.com", "code": "482910" }`
- Responses:
  - `200`: Verified successfully, returns opaque `session_token`
  - `400`: Incorrect code, expired code, or code already used
  - `429`: Locked out after 5 consecutive incorrect attempts

---

## Technical Details

### CSPRNG Function
I used Node.js's built-in `crypto.randomInt(0, 1000000)`. It samples from the OS's entropy pool (`/dev/urandom` on Unix, `BCryptGenRandom` on Windows) rather than pseudo-random math, avoiding predictability. The integer is padded with leading zeros to guarantee 6 digits.

### Hashing Choice (bcrypt)
Instead of SHA-256, I went with `bcrypt` (salt rounds: 10):
- **Built-in salt:** Prevents identical OTPs across users from producing identical hashes (kills rainbow tables).
- **Computationally slow:** A 6-digit number has only 1,000,000 possibilities. Fast hashes like SHA-256 can be brute-forced offline in milliseconds. Bcrypt introduces deliberate CPU cost, making offline guessing impractical within the 10-minute validity window.

### Rate Limiting Strategy
Both limits track the identifier directly, not the client IP address:
1. **Send Limit (SMS budget attack):** Managed in-memory via a rolling window. Allows at most 3 requests every 10 minutes per identifier.
2. **Brute-Force Guard:** Tracked via an `attempts` counter in the SQLite database row. Each failed verification increments the counter. If it reaches 5, the code is locked and subsequent attempts return HTTP 429.

---

## Threat Model: What if the OTP table leaks?

If an attacker dumps the SQLite `otps` table:

- **What they cannot get:**
  - The plaintext OTP codes. Because bcrypt is salted and slow, guessing the 6 digits for each row takes substantial compute per record. By the time an attacker could brute-force a hash, the 10-minute expiry window has passed.
  - User session tokens. Tokens are generated on-the-fly upon verification and are not saved in this table.

- **What they can get:**
  - A list of user email addresses and phone numbers.
  - Timestamps showing when users requested logins and whether those codes were successfully verified (`used = 1`).
