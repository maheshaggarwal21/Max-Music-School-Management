# MaxMusic — Local Testing Credentials & How-To

> ⚠️ **LOCAL / DEMO ONLY.** These are throwaway passwords set by `scripts/dev-credentials.js`
> against the **demo institution** on the dev database. They are NOT production secrets and must
> never be reused on a real deployment. Production credentials live only in the server's `.env`.

Demo institution slug: **`demo-music-school`** (brand shown to users: *"Demo Music School"* — the
"Max Music" operator brand is intentionally never shown on institution panels).

---

## 1. Bring the stack up (Windows / local)

The box has limited RAM, so run the **API + ONE panel at a time** (open the panel you're testing).
Always kill stale port holders first.

```bash
# 1) Kill anything already on the ports (stale next-dev/api zombies serve hung responses)
for p in 4000 3000 3001 3002 3003; do
  netstat -ano | grep ":$p" | grep -i listening | awk '{print $NF}' | xargs -r -n1 taskkill //F //PID
done

# 2) Start the API (port 4000) — leave it running
cd apps/api && npm run dev          # → "[api] running on port 4000"

# 3) Start the panel you want to test (separate terminal). Pick the port from the table below.
#    NEXT_IGNORE_INCORRECT_LOCKFILE=1 is required on Windows (SWC lockfile patch bug).
cd apps/operator-panel              && NEXT_IGNORE_INCORRECT_LOCKFILE=1 npx next dev -p 3000
cd apps/institution-admin-panel     && NEXT_IGNORE_INCORRECT_LOCKFILE=1 npx next dev -p 3001
cd apps/institution-teacher-panel   && NEXT_IGNORE_INCORRECT_LOCKFILE=1 npx next dev -p 3002
cd apps/institution-student-panel   && NEXT_IGNORE_INCORRECT_LOCKFILE=1 npx next dev -p 3003

# 4) (Re)set the known passwords + verify every login works against the live API
node scripts/dev-credentials.js     # resets passwords, grants owner-teacher admin, ensures a demo student
node scripts/verify-logins.js       # hits the API; should print "ALL LOGINS WORKING ✓"
```

> If a backend (`apps/api`) file is edited, nodemon's in-place restart can lose the port on Windows
> (`EADDRINUSE`) and keep serving stale code. Fix: kill the `:4000` PID and run `cd apps/api && npm run dev` again.

---

## 2. Login credentials

| Panel | URL | Login with | Username | Password | 2FA |
|-------|-----|-----------|----------|----------|-----|
| **Operator** (superadmin) | http://localhost:3000/login | **email** | `admin@maxmusic.internal` | `Operator@123` | **Yes — TOTP** (secret below) |
| **Admin** (institution) | http://localhost:3001/demo-music-school/admin/login | **email** | `teacher@demo.internal` | `Teacher@123` | No |
| **Teacher** (owner) | http://localhost:3002/demo-music-school/teacher/login | **mobile** | `9999999999` | `Teacher@123` | No |
| **Student** (default) | http://localhost:3003/demo-music-school/student/login | **mobile** | `8888888888` | `Student@123` | No |

### Data-rich accounts (recommended for real testing)
The default teacher (9999999999) and student (8888888888) have **no batch**, so they only show empty
states. Use these two to see live attendance, schedules, KPI, and class history:

| Role | URL | Login with | Username | Password | What it has |
|------|-----|-----------|----------|----------|-------------|
| **Teacher w/ batch** | http://localhost:3002/demo-music-school/teacher/login | mobile | `7777777777` | `Teacher@123` | Owns the *Guitar 17:00-18:00 (Mon-Wed)* batch + 1 student; attendance, Socket.io, KPI all populated |
| **Student w/ batch** | http://localhost:3003/demo-music-school/student/login | mobile | `6666666666` | `Student@123` | Enrolled in that batch + 2 attendance records; dashboard "next class", timetable grid, class history all populated |

---

## 3. Operator 2FA — getting the 6-digit code

The operator login is two-step: email + password → then a 6-digit TOTP code.

**TOTP secret:** `HQWBOILHHMGEO7TA`

Get a current code by any of:
- **Authenticator app** — add a manual/"enter a setup key" entry in Google Authenticator / Authy / 1Password using the secret above (type: time-based), then read the 6-digit code.
- **Command line** — `node scripts/verify-logins.js` logs in end-to-end and uses a freshly generated live code (proof the flow works).
- **One-liner** (from repo root):
  ```bash
  node -e "console.log(require('otplib').authenticator.generate('HQWBOILHHMGEO7TA'))"
  ```

Codes rotate every 30s — enter it promptly.

---

## 4. Login-flow quick reference

- **Operator** = email + password **+ TOTP** (private superadmin panel, separate domain in prod).
- **Admin** = **email** (`teacher@demo.internal`). The institution admin is the *owner teacher* whose
  `panelAccess` includes `admin` — the **same person** logs into both the admin and teacher panels.
- **Teacher / Student** = **mobile number** + password.
- Cookies are httpOnly and path-scoped — logging into one panel never leaks the session to another.
- Every institution URL leads with the slug: `/<slug>/<panel>/...` (here `/demo-music-school/...`).

---

## 5. Resetting / troubleshooting

- **"Invalid credentials"** → re-run `node scripts/dev-credentials.js` (passwords drift if the DB was reseeded).
- **The two data-rich accounts (7777777777 / 6666666666)** are *not* reset by `dev-credentials.js`
  (they were created during QA). If their passwords are ever lost, re-set them to `Teacher@123` /
  `Student@123` with a one-off using `apps/api/src/config/password`'s `hash()` on the `teachers` /
  `students` doc (displayId `100003` / `106002`).
- **Page 404s behind a path** → make sure you used the full `/<slug>/<panel>/login` URL, not `/login`.
- **Empty dashboards** → you're on a no-batch account; switch to the data-rich account above.
