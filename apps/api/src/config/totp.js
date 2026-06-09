'use strict';

const { authenticator } = require('otplib');
const QRCode = require('qrcode');

function configure() {
  authenticator.options = {
    algorithm: (process.env.TOTP_ALGORITHM || 'SHA1').toLowerCase(),
    digits:    Number(process.env.TOTP_DIGITS  || 6),
    step:      Number(process.env.TOTP_PERIOD  || 30),
    window:    1,
  };
}
configure();

function generateSecret() {
  return authenticator.generateSecret();
}

function otpauthUrl({ email, secret }) {
  const issuer = process.env.TOTP_ISSUER || 'MaxMusicAdmin';
  return authenticator.keyuri(email, issuer, secret);
}

async function qrDataUrl({ email, secret }) {
  const uri = otpauthUrl({ email, secret });
  return QRCode.toDataURL(uri);
}

function verify(code, secret) {
  if (!code || !secret) return false;
  try {
    return authenticator.verify({ token: String(code).trim(), secret });
  } catch {
    return false;
  }
}

module.exports = { generateSecret, otpauthUrl, qrDataUrl, verify };
