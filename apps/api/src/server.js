'use strict';

require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 4000;

// ── Security & parsing middleware ────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  // Drop undefined entries so a missing env var can never collapse the
  // allow-list into "reflect any origin".
  origin: [process.env.PLATFORM_DOMAIN_URL, process.env.OPERATOR_DOMAIN_URL].filter(Boolean),
  credentials: true,
}));
// Razorpay webhook needs the RAW body for HMAC signature verification, so it is
// mounted BEFORE the JSON parser (and before apiLimiter — Razorpay must not be
// rate-limited). It fully handles + responds, so the request never falls through.
const webhookRoutes = require('./routes/webhook');
app.use('/api/webhooks', express.raw({ type: '*/*' }), webhookRoutes);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

// ── Routes ───────────────────────────────────────────────────────────────────
const { apiLimiter } = require('./middleware/rateLimit');
const authRoutes     = require('./routes/auth');
const operatorRoutes = require('./routes/operator');
const institutionRoutes = require('./routes/institution'); // Phase 4 (stub router)

app.use('/api', apiLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/operator', operatorRoutes);
app.use('/api/inst', institutionRoutes);

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', env: process.env.NODE_ENV }));

// ── 404 fallback ─────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ success: false, message: 'Not found' }));

// ── Global error handler ──────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// ── Bootstrap ────────────────────────────────────────────────────────────────
async function start() {
  await require('./config/db').connect();

  // Wrap Express in an HTTP server so Socket.io can share the port.
  const server = http.createServer(app);
  require('./config/socket').init(server);   // live attendance — rooms by institutionId
  require('./config/cron').init();            // daily joinStatus / validity / rent maintenance

  server.listen(PORT, () => {
    console.log(`[api] running on port ${PORT} (${process.env.NODE_ENV})`);
  });
}

start().catch(err => {
  console.error('[api] startup failed:', err);
  process.exit(1);
});

module.exports = app;
