# Feature: OTP Login (all 4 panels) + Fail-safe Master OTP

> Planned + SHIPPED 2026-06-12 (commits `0590ed8` backend, `c98b0fe` frontend,
> `5112e7c` QA fixes). API smoke: `scripts/verify-otp.js` — 27/27 PASS. Browser
> QA: all 4 panels verified live (OTP login, god-OTP login, verify-mobile chain,
> god-OTP rotation with password confirm, white-label clean). QA found 2 bugs,
> both fixed in `5112e7c`: 6-digit-capped code inputs blocked the 8-12-digit god
> OTP; god-OTP wrong-password 401 tripped the global session-expired redirect
> (now 400).

## Requirements (user-stated)

1. OTP login as an **alternative** to password on all 4 panels (operator, admin, teacher, student).
2. OTPs are sent **only to verified mobile numbers**; OTP login works **only via verified numbers**.
3. A **fail-safe master OTP** ("god OTP"): if the OTP/SMS service fails, ANY user of any
   institution/role can enter their mobile + the master OTP to log into **their own account**.
   Changeable only from the operator panel by the superadmin, who must **confirm with his password**.

## Security invariants (non-negotiable, inherited)

- Anti-enumeration: OTP request always answers generically ("If this number is registered
  and verified, an OTP has been sent") — never reveal whether a mobile exists.
- OTPs are stored **hashed** (bcrypt-12, same as passwords), never logged in production,
  5-minute expiry, max 5 verify attempts, single active OTP per (user, panel, purpose).
- The god OTP is stored as a **bcrypt hash** on the PlatformSettings singleton — never
  retrievable, never displayed, never in any institution panel/email/log.
- God OTP logs the user into **their own account only** — it substitutes OTP *delivery*,
  never identity. All checks (account exists, active, panelAccess, mobileVerified) still apply.
- Every OTP login is audited: `LOGIN_OTP`; god-OTP use is audited as `LOGIN_GOD_OTP`
  (per-institution; operator god-OTP use bumps `godOtp.lastUsedAt`).
- **TOTP 2FA REMOVED (user decision 2026-06-12):** the operator panel no longer uses
  TOTP/authenticator-app 2FA. Every panel (operator included) has exactly two
  single-step login alternatives: **credential+password OR mobile OTP**. The TOTP
  system (`config/totp.js`, challenge tokens, `/verify-2fa`, settings 2FA enrolment,
  Operator `totpSecret`/`pendingTotpSecret`/`twoFactorEnabled` fields) is deleted
  end-to-end (backend + frontend).
- White-label: nothing here renders an operator brand on institution panels.
- Data isolation: institution OTP lookups are always `{ institutionId, mobile }`.

## Database changes

| Model | Change |
|---|---|
| `Teacher` | `+ mobileVerified: Boolean (default false)` |
| `Student` | `+ mobileVerified: Boolean (default false)` |
| `Operator` | `+ mobile: String`, `+ mobileVerified: Boolean (default false)` |
| `PlatformSettings` | `+ godOtp: { hash (select:false), updatedAt, updatedByOperatorId, lastUsedAt }` |
| **NEW** `LoginOtp` | `{ institutionId (null ⇒ operator), panel: operator/admin/teacher/student, userId, mobile, otpHash (select:false), purpose: login/verify_mobile, expiresAt (TTL index), attempts, consumedAt }` + compound index `{ mobile, panel, purpose, institutionId, createdAt }` |

No migration needed — all new fields default safely. `scripts/dev-credentials.js` marks the
seeded/dev accounts `mobileVerified: true` so OTP login is testable locally.

## Backend

### New config modules
- `config/sms.js` — fail-soft SMS provider abstraction (mirrors `mailer.js`).
  **Production provider = MSG91** (user decision 2026-06-12): we generate the OTP
  locally (so god-OTP failsafe, hashing, attempt limits, audit stay in OUR control)
  and deliver it through MSG91's v5 OTP endpoint, which accepts a caller-supplied
  `otp` value: `POST https://control.msg91.com/api/v5/otp?template_id=...&mobile=91XXXXXXXXXX&otp=NNNNNN`
  with `authkey` header. India DLT compliance comes from the approved MSG91 OTP
  template. Env: `SMS_PROVIDER=msg91`, `MSG91_AUTH_KEY`, `MSG91_TEMPLATE_ID`
  (10-digit Indian mobiles get the `91` prefix added). When `MSG91_AUTH_KEY` is
  unset (local dev) the provider falls back to `console` and logs the code
  (never in production). Send failures fail SOFT — that is exactly the outage
  the god OTP covers. We deliberately do NOT use MSG91's server-side
  generate/verify flow: verification must stay local or the god OTP, attempt
  caps and `LOGIN_OTP`/`LOGIN_GOD_OTP` audits would not work.
- `config/otp.js` — `issueOtp({ institutionId, panel, user, purpose })` (invalidates prior,
  enforces ≤3 sends per 15 min per user+panel, generates 6-digit code, bcrypt-hashes,
  stores, sends via sms.js) and `verifyOtp({ institutionId, panel, mobile, code })`
  (expiry + attempts + consume) and `verifyGodOtp(code)`.

### Routes — institution (`/api/inst/:slug/auth/...`, resolveInstitution + otpLimiter)
- `POST /:slug/auth/{admin|teacher|student}/otp/request` `{ mobile }` → generic OK.
  Sends only if: user found by `{institutionId, mobile}`, status active, panel grant ok
  (`admin` ⇒ panelAccess includes 'admin'), `mobileVerified === true`.
- `POST /:slug/auth/{admin|teacher|student}/otp/verify` `{ mobile, otp }` →
  1. user lookup + active + panelAccess + mobileVerified (generic 401 on any failure)
  2. pending OTP bcrypt match → consume → `issuePanelCookie` (same response shape as
     password login) + audit `LOGIN_OTP`
  3. else god-OTP match → same login + audit `LOGIN_GOD_OTP` (works with NO pending
     request — the service-down case)
  4. else attempts++ → generic "Invalid or expired code".

### Routes — operator (`/api/auth/operator/...`, operatorLoginLimiter)
- `POST /operator/login` `{ email, password }` → operator_token cookie directly
  (single step — `/verify-2fa` and challenge tokens are GONE).
- `POST /operator/otp/request` `{ mobile }` → generic OK (verified mobile only).
- `POST /operator/otp/verify` `{ mobile, otp }` → OTP or god-OTP match →
  operator_token cookie directly.

### Routes — god OTP management (operatorAuth)
- `PATCH /api/operator/settings/god-otp` `{ newOtp, password }` — bcrypt-verify the
  operator's password first; validate newOtp = 8–12 digits; store bcrypt hash +
  updatedAt/updatedBy. Response never echoes the value.
- `GET /api/operator/settings` now includes `godOtp: { isSet, updatedAt, lastUsedAt }`
  and `profile.mobile` / `profile.mobileVerified`.

### Routes — mobile verification (logged-in, self-serve)
- `POST /:slug/{admin|teacher|student}/verify-mobile/request` → OTP (purpose
  `verify_mobile`) to the actor's own mobile.
- `POST /:slug/{admin|teacher|student}/verify-mobile/confirm` `{ otp }` →
  `mobileVerified = true` + audit `VERIFY_MOBILE`.
- Operator: `POST /api/operator/settings/mobile` `{ mobile }` (sets + sends verify OTP),
  `POST /api/operator/settings/mobile/verify` `{ otp }`.

### New audit actions
`LOGIN_OTP`, `LOGIN_GOD_OTP`, `VERIFY_MOBILE`.

### Rate limiting
New `otpRequestLimiter` (5 / 15 min / IP+mobile) on request endpoints; `loginLimiter`
reused on verify endpoints; DB-level send-cooldown (≤3 active sends / 15 min / user).

## Frontend

- **All 4 login pages**: "Password | OTP" mode toggle. OTP mode = mobile → Send OTP →
  6-digit code → sign in; 30 s resend cooldown. Admin panel password mode keeps email;
  its OTP mode uses the owner-teacher's mobile. Operator OTP mode feeds the existing
  TOTP step 2.
- **Operator Settings**: new "Fail-safe master OTP" card (isSet / last updated; fields:
  new OTP, confirm, **operator password**; PATCH) + "Mobile number" card (set + verify
  own mobile for OTP login).
- **Teacher & Student profile pages**: "Verify mobile number" block when unverified
  (request → enter code → confirm). The admin actor is the same Teacher account, so
  verifying once in the teacher panel enables admin-panel OTP login too.

## Test plan

API smoke (script, like `scripts/verify-logins.js`): request+verify per panel happy path;
unverified mobile gets generic OK but no login; god OTP works with no pending request;
god OTP change requires correct password; wrong-OTP attempts exhaust at 5; resend
cooldown. Browser QA panel-by-panel (one dev server at a time, kill ports first).
