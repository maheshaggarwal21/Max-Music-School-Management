'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// Phase 7 — Socket.io. Rooms are keyed by institutionId (the ONLY tenant
// boundary). A socket can ONLY join the room of the institution baked into its
// verified handshake token — never a client-supplied value — so live events
// (e.g. attendance:marked) never cross tenants.
//
// AUTH: panel cookies are httpOnly AND path-scoped to /api/inst/:slug, so they
// are never delivered to the /socket.io handshake. Instead the client first
// calls an authenticated REST endpoint (GET /:slug/<panel>/realtime-token) which
// mints a short-lived socket token, then presents it in handshake.auth.token.
// ─────────────────────────────────────────────────────────────────────────────

const { Server } = require('socket.io');
const { verifySocketToken } = require('./jwt');

let io = null;

function roomFor(institutionId) {
  return `inst:${String(institutionId)}`;
}

function init(server) {
  io = new Server(server, {
    // Same allow-list as the REST CORS — never reflect arbitrary origins.
    cors: {
      origin: [process.env.PLATFORM_DOMAIN_URL, process.env.OPERATOR_DOMAIN_URL].filter(Boolean),
      credentials: true,
    },
  });

  // Handshake auth — reject anything without a valid, unexpired socket token.
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth && socket.handshake.auth.token;
      if (!token) return next(new Error('unauthorized'));
      const d = verifySocketToken(token);
      socket.data.institutionId = d.institutionId;
      socket.data.userId = d.sub;
      socket.data.role = d.role;
      return next();
    } catch {
      return next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const room = roomFor(socket.data.institutionId);
    socket.join(room);
    socket.emit('ready', { room });
  });

  console.log('[socket] initialised');
  return io;
}

// Emit to every socket in an institution's room. No-op if Socket.io is not
// initialised (e.g. unit tests) — callers must never depend on delivery.
function emitToInstitution(institutionId, event, payload) {
  if (!io || !institutionId) return;
  io.to(roomFor(institutionId)).emit(event, payload);
}

module.exports = { init, emitToInstitution, roomFor };
