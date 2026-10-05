'use strict';

const express = require('express');
const router  = express.Router();

const { sendOTP, verifyOTPHandler } = require('../otpService');

router.post('/send',   sendOTP);
router.post('/verify', verifyOTPHandler);

module.exports = router;
