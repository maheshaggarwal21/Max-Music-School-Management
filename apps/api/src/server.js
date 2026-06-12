'use strict';

// The single source of truth for env is the repo-root .env. Load a local
// apps/api/.env first (developer override, if any), then fill the rest from the
// repo root by absolute path — so env is found whether the process starts from
// apps/api (nodemon/turbo dev) or the repo root (PM2 prod). dotenv never
// overrides an already-set var, so the local file wins where both define a key.
require('dotenv').config();
require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });
const http = require('http');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 4000;

// ── Security & parsing middleware ────────────────────────────────────────────
app.use(helmet());
// Gzip JSON responses — list endpoints (audit feeds, rosters) shrink 5-10x over
// the wire. Webhook raw-body HMAC is unaffected (compression is response-side).
app.use(compression());
// Drop undefined entries so a missing env var can never collapse the
// allow-list into "reflect any origin".
// CORS_ORIGINS accepts a comma-separated list for multi-URL deployments
// (e.g. Vercel gives each panel its own *.vercel.app domain).
const allowedOrigins = [
  process.env.PLATFORM_DOMAIN_URL,
  process.env.OPERATOR_DOMAIN_URL,
  ...(process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',').map(o => o.trim()) : []),
].filter(Boolean);
const isDev = process.env.NODE_ENV !== 'production';
app.use(cors({
  // In production every institution panel shares ONE platform origin, so the
  // env allow-list is exact. In local dev each panel runs on its own port
  // (operator 3000, admin 3001, teacher 3002, student 3003) = distinct origins,
  // so additionally allow any localhost/127.0.0.1 port.
  origin(origin, cb) {
    if (!origin) return cb(null, true); // same-origin / curl / server-to-server
    if (allowedOrigins.includes(origin)) return cb(null, true);
    if (isDev && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
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
