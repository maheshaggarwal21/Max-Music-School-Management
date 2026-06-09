'use strict';

require('dotenv').config();
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
  origin: [
    process.env.PLATFORM_DOMAIN_URL,
    process.env.OPERATOR_DOMAIN_URL,
  ],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

// ── Routes (uncomment as phases complete) ────────────────────────────────────
// Phase 2-4: const authRoutes       = require('./routes/auth');
// Phase 3:   const operatorRoutes   = require('./routes/operator');
// Phase 4:   const institutionRoutes = require('./routes/institution');
// app.use('/api', authRoutes);
// app.use('/api/operator', operatorRoutes);
// app.use('/api/inst', institutionRoutes);

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
  // Phase 7: require('./config/socket').init(server);
  // Phase 7: require('./config/cron').init();

  app.listen(PORT, () => {
    console.log(`[api] running on port ${PORT} (${process.env.NODE_ENV})`);
  });
}

start().catch(err => {
  console.error('[api] startup failed:', err);
  process.exit(1);
});

module.exports = app;
