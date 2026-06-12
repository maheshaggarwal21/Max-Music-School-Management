# MaxMusic — Testing Credentials & How-To

> ⚠️ **LOCAL / DEMO ONLY.** These are throwaway passwords set by `scripts/dev-credentials.js`
> against the **demo institution** on the dev database. They are NOT production secrets and must
> never be reused on a real deployment. Production credentials live only in the server's `.env`.

Demo institution slug: **`demo-music-academy`** (brand shown to users: *"Demo Music School"* — the
"Max Music" operator brand is intentionally never shown on institution panels).

> **Two login methods everywhere:** every panel accepts **password** OR **mobile OTP**.
> TOTP 2FA was removed (2026-06-12); operator login is single-step. OTP codes are sent via MSG91
> in production; in local dev they print to the API console. When SMS is unavailable, the
> **god OTP** works on any panel's OTP screen for any verified mobile (see §3).

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

| Panel | URL | Login with | Username | Password |
|-------|-----|-----------|----------|----------|
| **Operator** (superadmin) | http://localhost:3000/login | **email** | `admin@maxmusic.internal` | `Operator@123` |
| **Admin** (institution) | http://localhost:3001/demo-music-academy/admin/login | **email** | `teacher@demo.internal` | `Teacher@123` |
| **Teacher** (owner) | http://localhost:3002/demo-music-academy/teacher/login | **mobile** | `9999999999` | `Teacher@123` |
| **Student** (default) | http://localhost:3003/demo-music-academy/student/login | **mobile** | `8888888888` | `Student@123` |

Operator can also log in by **mobile OTP** with `9000000001`. All four accounts above have
**verified mobiles**, so OTP login (incl. god OTP) works for each.

### Data-rich accounts (recommended for real testing)
The default teacher (9999999999) and student (8888888888) have **no batch**, so they only show empty
states. Use these two to see live attendance, schedules, KPI, and class history:

| Role | URL | Login with | Username | Password | What it has |
|------|-----|-----------|----------|----------|-------------|
| **Teacher w/ batch** | http://localhost:3002/demo-music-academy/teacher/login | mobile | `7777777777` | `Teacher@123` | Owns the *Guitar 17:00-18:00 (Mon-Wed)* batch + 1 student; attendance, Socket.io, KPI all populated |
| **Student w/ batch** | http://localhost:3003/demo-music-academy/student/login | mobile | `6666666666` | `Student@123` | Enrolled in that batch + 2 attendance records; dashboard "next class", timetable grid, class history all populated |

---

## 3. OTP login & the god OTP

Every login screen has a **Password | OTP** toggle.

- **Normal OTP:** choose OTP, enter the mobile, request the code. In **local dev** the 6-digit code
  prints to the **API console**; in production it is texted via MSG91 (needs `MSG91_AUTH_KEY` +
  `MSG91_TEMPLATE_ID`). OTPs only go to **verified** mobiles.
- **God OTP (SMS-outage failsafe):** current value **`88990011`** (8 digits). Works on any panel's
  OTP screen for any **verified** mobile with no code request — it bypasses the code, not the
  identity (the mobile must still be `mobileVerified`, active, and have the right panel access).
  Set/rotate it in **Operator → Settings → god-OTP** (requires the operator's password).
  **Change it before any real launch.**

---

## 4. Login-flow quick reference

- **Operator** = email + password **OR** mobile OTP (single-step; private superadmin panel, separate domain in prod).
- **Admin** = **email** (`teacher@demo.internal`) + password, or mobile `9999999999` + OTP. The institution
  admin is the *owner teacher* whose `panelAccess` includes `admin` — the **same person** logs into both
  the admin and teacher panels.
- **Teacher / Student** = **mobile number** + password, or mobile + OTP.
- Cookies are httpOnly and path-scoped — logging into one panel never leaks the session to another.
- Every institution URL leads with the slug: `/<slug>/<panel>/...` (here `/demo-music-academy/...`).

---

## 5. Live cloud demo (Render + Vercel)

A public free-tier demo is deployed. Same credentials as above; the slug is `demo-music-academy`.

| Panel | URL |
|---|---|
| Operator | https://maxmusic-operator.vercel.app/login |
| Admin | https://maxmusic-admin.vercel.app/demo-music-academy/admin/login |
| Teacher | https://maxmusic-teacher.vercel.app/demo-music-academy/teacher/login |
| Student | https://maxmusic-student.vercel.app/demo-music-academy/student/login |

> The free API server **sleeps after ~15 min idle** — the first request takes ~30-60s to wake; refresh once.
> A polished, client-facing version of this guide (with feature tour + FAQ) is generated by
> `scripts/make-client-testing-guide.py` → `MaxMusic-Client-Testing-Guide.{docx,pdf}`.
> Deploy details: `.claude/documentation/DEPLOY.md §0`.

---

## 6. Resetting / troubleshooting

- **"Invalid credentials"** → re-run `node scripts/dev-credentials.js` (passwords drift if the DB was reseeded).
- **The two data-rich accounts (7777777777 / 6666666666)** are *not* reset by `dev-credentials.js`
  (they were created during QA). If their passwords are ever lost, re-set them to `Teacher@123` /
  `Student@123` with a one-off using `apps/api/src/config/password`'s `hash()` on the `teachers` /
  `students` doc (displayId `100003` / `106002`).
- **OTP not arriving in dev** → it's printed to the API console, not texted. Or use the god OTP (§3).
- **Page 404s behind a path** → make sure you used the full `/<slug>/<panel>/login` URL, not `/login`.
- **Empty dashboards** → you're on a no-batch account; switch to the data-rich account above.
