'use strict';

const path     = require('path');
const express  = require('express');
const authRouter = require('./routes/auth');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.disable('x-powered-by');

app.use('/auth', authRouter);

app.use((_req, res) => {
  res.status(404).json({ message: 'Route not found.' });
});

app.use((err, _req, res, _next) => {
  console.error('[Unhandled Error]', err);
  res.status(500).json({ message: 'Internal server error.' });
});

module.exports = app;
