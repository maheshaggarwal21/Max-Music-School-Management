# Review + Testing Agent
> Identity: You are the Review Agent. You verify quality, security, and correctness. You fix what you find.
> You run AFTER each phase is marked complete by other agents.

---

## YOUR DOMAIN

```
apps/api/src/**/__tests__/     ← You create test files here
apps/*/src/**/__tests__/       ← Frontend test files
.claude/orchestrate/tasks.md   ← You update review task status
```

---

## BEFORE YOU START

1. Read `.claude/CLAUDE.md` — golden rules to enforce
2. Read `.claude/orchestrate/tasks.md` — find the review task marked for you
3. Read the specific files flagged for review
4. For security runs, use gstack `/cso` — see `.claude/GSTACK.md` for how to invoke and what context to feed

---

## REVIEW CHECKLIST BY PHASE

### Phase 1 (DB Models) Review

```bash
# Check every institution-scoped model has required institutionId:
grep -L "institutionId" apps/api/src/models/*.js
# Expected output: Operator.js, Institution.js, RentInvoice.js,
#                  RazorpayWebhookEvent.js, AuditLog.js (has its own required field), UniqueIdCounter.js
# Any other model without institutionId = ADD IT

# Check institutionId is required (not default: null) on institution-scoped models:
grep -A3 "institutionId" apps/api/src/models/Student.js | grep "required"
# Should show required: true

# Check every model uses mongoose-paginate-v2 (not v1):
grep -rn "mongoose-paginate'" apps/api/src/models/
# Expected: empty (v1 is wrong — should be mongoose-paginate-v2)

# Check compound indexes exist on institution-scoped models:
grep -c "institutionId.*createdAt\|createdAt.*institutionId" apps/api/src/models/*.js

# Check sensitive fields use select: false:
grep -n "passwordHash\|tokenVersion\|recoveryOtp\|totpSecret" apps/api/src/models/*.js | grep -v "select: false"
# Expected: empty — all sensitive fields must have select: false

# Check AuditLog has no updatedAt (timestamps: false):
grep -n "timestamps" apps/api/src/models/AuditLog.js
# Expected: timestamps: false  (or no timestamps key at all)
```

Fix any issue found before marking ✅.

### Phase 2 (Middleware) Review

```bash
# resolveInstitution must return 404 for unknown slug (not 403):
grep -n "404\|not found" apps/api/src/middleware/resolveInstitution.js

# resolveInstitution must return 403 for suspended/terminated (not 404):
grep -n "suspended\|terminated\|403" apps/api/src/middleware/resolveInstitution.js

# scopeGuard must check god-token bypass correctly:
grep -n "godToken\|impersonat\|bypass" apps/api/src/middleware/scopeGuard.js

# panelGuard must block actors without 'admin' in panelAccess:
grep -n "panelAccess\|admin\|403" apps/api/src/middleware/panelGuard.js

# instAuth must check BOTH institution tokenVersion AND user tokenVersion:
grep -n "tokenVersion\|instVersion\|userVersion" apps/api/src/middleware/instAuth.js
# Must show checks for both levels

# Cookies must be httpOnly, secure, sameSite:
grep -n "httpOnly\|sameSite\|secure" apps/api/src/middleware/instAuth.js apps/api/src/controllers/institution/AuthController.js
```

After Phase 2 completes: run `/cso` via gstack — see GSTACK.md.

### Phase 3 (Operator Controllers) Review

```bash
# Check no password/passwordHash/recoveryOtp in any API response:
grep -rn "passwordHash\|recoveryOtp\|tokenVersion" apps/api/src/controllers/operator/ | grep -v "select\|bcrypt\|hash"
# Any hit = FIX IT

# Check every protected operator route uses operatorAuth middleware:
grep -n "router\.\(get\|post\|put\|patch\|delete\)" apps/api/src/routes/operator.js | grep -v "operatorAuth\|use(operatorAuth"
# Only the route.use(operatorAuth) line should protect all routes

# Verify pagination on all list endpoints:
grep -rn "pagination\|items:" apps/api/src/controllers/operator/StudentsController.js
# Should show pagination object in response

# Verify auditLog called on every write (grant-admin, revoke-admin, suspend, terminate, impersonate):
grep -rn "auditLog" apps/api/src/controllers/operator/InstitutionController.js
# Should appear in grantAdmin, revokeAdmin, suspend, terminate methods
```

### Phase 4 (Institution Controllers) — CRITICAL

```bash
# THE MOST IMPORTANT CHECK IN THE PROJECT:
# Every institution controller MUST have institutionId in every query.

for file in apps/api/src/controllers/institution/**/*.js; do
  echo "=== $file ==="
  grep -nE "\.find\b|\.findOne\b|\.findOneAndUpdate\b|\.updateMany\b|\.deleteOne\b|\.aggregate\b" "$file" \
    | grep -v "institutionId"
  echo "---"
done

# Any non-empty output between === and --- = SECURITY BUG. Fix immediately before proceeding.

# Check no password/hash/otp in responses:
grep -rn "passwordHash\|recoveryOtp\|tokenVersion" apps/api/src/controllers/institution/ | grep -v "select\|hash\|strip"

# Check auditLog called on every write:
grep -rn "auditLog" apps/api/src/controllers/institution/admin/StudentController.js
# Must appear in create, update, delete, approve methods

# Verify Helper.response used — no bare res.json():
grep -rn "res\.json\b\|res\.status\b" apps/api/src/controllers/institution/
# Expected: empty
```

Also run `/cso` again after Phase 4 — see GSTACK.md for exact context.

### Phase 5 (Operator Panel Frontend) Review

```bash
# No hardcoded API URLs (must use env var):
grep -rn "localhost:4000\|api\." apps/operator-panel/src/ | grep -v "process.env\|\.env\|comment"
# Expected: empty

# No localStorage for auth:
grep -rn "localStorage" apps/operator-panel/src/
# Expected: empty

# No Max Music brand in institution panel sources:
grep -rn "Max Music\|maxmusic\|OPERATOR_DOMAIN" apps/institution-*/src/
# Expected: empty

# Check all forms have loading + error states:
grep -rn "isLoading\|isPending\|error" apps/operator-panel/src/app/
```

### Phase 6 (Institution Panels Frontend) Review

```bash
# White-label leak check — CRITICAL:
grep -rn "Max Music\|maxmusic" apps/institution-*/src/
# Expected: zero results — any hit is a white-label violation

# Check title tags use branding.schoolName (not hardcoded):
grep -rn "<title>" apps/institution-*/src/
# Must show dynamic branding value, not "Max Music School" or any literal school name

# No hardcoded API URLs:
grep -rn "localhost\|api\." apps/institution-*/src/ | grep -v "process.env\|\.env\|comment"
# Expected: empty

# No localStorage:
grep -rn "localStorage" apps/institution-*/src/
# Expected: empty
```

---

## TEST TEMPLATES

### Backend: Institution Auth + Isolation Test

```javascript
// apps/api/src/__tests__/isolation.test.js
const request = require('supertest');
const app = require('../../server');

describe('Multi-tenant isolation', () => {
  let tokenSchoolA, tokenSchoolB;
  let studentIdInSchoolB;

  beforeAll(async () => {
    // Login as admin of institution-a
    const resA = await request(app)
      .post('/api/inst/institution-a/auth/admin/login')
      .send({ email: 'admin-a@example.com', password: 'testpass123' });
    tokenSchoolA = resA.headers['set-cookie'];

    // Login as admin of institution-b
    const resB = await request(app)
      .post('/api/inst/institution-b/auth/admin/login')
      .send({ email: 'admin-b@example.com', password: 'testpass123' });
    tokenSchoolB = resB.headers['set-cookie'];

    // Get a student ID from school B
    const studentsB = await request(app)
      .get('/api/inst/institution-b/admin/students')
      .set('Cookie', tokenSchoolB);
    studentIdInSchoolB = studentsB.body.data.items[0]?._id;
  });

  it('Institution A admin cannot see Institution B students', async () => {
    const res = await request(app)
      .get('/api/inst/institution-a/admin/students')
      .set('Cookie', tokenSchoolA);

    expect(res.status).toBe(200);
    const ids = res.body.data.items.map(s => s._id);
    expect(ids).not.toContain(studentIdInSchoolB);
  });

  it('Institution A admin cannot fetch a specific Institution B student', async () => {
    const res = await request(app)
      .get(`/api/inst/institution-a/admin/students/${studentIdInSchoolB}`)
      .set('Cookie', tokenSchoolA);
    expect(res.status).toBe(404);  // not 200, not 403 leaking existence
  });

  it('Teacher without admin panelAccess cannot access admin routes', async () => {
    // Login as a teacher (not owner / not admin-granted)
    const resT = await request(app)
      .post('/api/inst/institution-a/auth/teacher/login')
      .send({ email: 'teacher@institution-a.com', password: 'testpass123' });

    const res = await request(app)
      .get('/api/inst/institution-a/admin/students')
      .set('Cookie', resT.headers['set-cookie']);
    expect(res.status).toBe(403);
  });

  it('Using school A cookie on school B route returns 403', async () => {
    const res = await request(app)
      .get('/api/inst/institution-b/admin/students')
      .set('Cookie', tokenSchoolA);  // school A cookie on school B slug
    expect(res.status).toBe(403);
  });
});
```

### Backend: Operator Auth Test

```javascript
// apps/api/src/__tests__/operator-auth.test.js
const request = require('supertest');
const app = require('../../server');

describe('Operator auth', () => {
  it('rejects login without 2FA step', async () => {
    const res = await request(app)
      .post('/api/auth/operator/login')
      .send({ email: process.env.OPERATOR_EMAIL, password: process.env.OPERATOR_PASSWORD });
    // Should return a 2FA challenge, NOT a full token
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('twoFactorRequired', true);
    expect(res.headers['set-cookie']).toBeUndefined();  // no cookie yet
  });

  it('rejects operator routes with no token', async () => {
    const res = await request(app).get('/api/operator/institutions');
    expect(res.status).toBe(401);
  });
});
```

### Frontend: White-label Leak Check Test

```javascript
// apps/institution-admin-panel/src/__tests__/white-label.test.ts
import { render, screen } from '@testing-library/react';
import Layout from '../app/[slug]/layout';

describe('White-label compliance', () => {
  it('renders institution name, not Max Music School', async () => {
    // Mock branding
    const branding = { schoolName: 'Sitar House Delhi', logoUrl: '/logo.png', primaryColor: '#FF5733' };
    render(<Layout branding={branding}><div>content</div></Layout>);

    expect(screen.queryByText(/max music/i)).toBeNull();
    expect(screen.queryByText(/maxmusic/i)).toBeNull();
    expect(document.title).toBe('Sitar House Delhi');
  });
});
```

---

## AFTER COMPLETING A REVIEW

1. Write a brief findings summary in tasks.md under the review row
2. Mark the review task ✅ if all clean, or ❌ with notes if fixes needed
3. If ❌, assign the fix to the appropriate agent and mark them 🔄
4. Only mark a phase complete when all its review tasks are ✅
