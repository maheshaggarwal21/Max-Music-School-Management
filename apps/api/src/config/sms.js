'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// SMS delivery for OTPs — fail-SOFT like config/mailer: a send failure logs and
// returns { sent: false } instead of throwing. That outage is exactly what the
// platform god OTP (PlatformSettings.godOtp) exists to cover.
//
// Provider: MSG91 (production). We generate codes locally and pass our own
// `otp` value to MSG91's v5 OTP endpoint — NEVER their server-side
// generate/verify flow, or the god-OTP failsafe, attempt caps and
// LOGIN_OTP/LOGIN_GOD_OTP audits would stop working. DLT compliance comes from
// the approved MSG91 OTP template (MSG91_TEMPLATE_ID).
//
// Env: SMS_PROVIDER=msg91, MSG91_AUTH_KEY, MSG91_TEMPLATE_ID.
// Without MSG91_AUTH_KEY (local dev) the code is logged to the console — only
// outside production. WHITE-LABEL: the SMS body comes from the neutral MSG91
// template; no operator brand reaches any institution user.
// ─────────────────────────────────────────────────────────────────────────────

const MSG91_OTP_URL = 'https://control.msg91.com/api/v5/otp';

// Indian 10-digit numbers need the 91 country prefix for MSG91.
function toMsg91Mobile(mobile) {
  const digits = String(mobile).replace(/\D/g, '');
  return digits.length === 10 ? `91${digits}` : digits;
}

async function sendViaMsg91({ mobile, otp }) {
  const params = new URLSearchParams({
    template_id: process.env.MSG91_TEMPLATE_ID || '',
    mobile:      toMsg91Mobile(mobile),
    otp:         String(otp),
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${MSG91_OTP_URL}?${params}`, {
      method:  'POST',
      headers: { authkey: process.env.MSG91_AUTH_KEY, accept: 'application/json' },
      signal:  controller.signal,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.type === 'error') {
      console.error('[sms] msg91 send failed', res.status, body.message || '');
      return { sent: false };
    }
    return { sent: true };
  } catch (err) {
    console.error('[sms] msg91 send failed', err.message);
    return { sent: false };
  } finally {
    clearTimeout(timer);
  }
}

async function sendOtpSms({ mobile, otp }) {
  if (!mobile || !otp) return { sent: false };

  if (process.env.MSG91_AUTH_KEY) return sendViaMsg91({ mobile, otp });

  if (process.env.NODE_ENV !== 'production') {
    // Dev fallback: surface the code in the API console so local QA can log in.
    console.log(`[sms] (dev console provider) OTP for ${mobile}: ${otp}`);
    return { sent: true };
  }

  console.error('[sms] no SMS provider configured — OTP not sent');
  return { sent: false };
}

module.exports = { sendOtpSms };
