'use strict';

const app = require('./src/app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`OTP server running on http://localhost:${PORT}`);
  console.log('[DEV] OTP codes are logged to this console instead of being delivered via SMS/email.');
});
