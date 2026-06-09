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
# Run for every model file:
node -e "require('./apps/api/src/models/StudentModel')" 2>&1
# Should print nothing (no errors)

# Check every model has institutionId (except AdminModel, Contact, Razorpay):
grep -L "institutionId" apps/api/src/models/*.js
# Expected output: AdminModel.js, ContactModel.js, RazorpayWebhookModel.js only

# Check every model has compound indexes:
grep -c "institutionId.*createdDate\|createdDate.*institutionId" apps/api/src/models/*.js

# Check no model is missing mongoosePaginate:
grep -L "mongoosePaginate" apps/api/src/models/*.js
# Expected: empty output
```

Fix any issue found before marking ✅.

### Phase 2 (Middleware) Review

```bash
# resolveInstitution must return 404 for unknown slug (not 403):
grep -n "404\|not found" apps/api/src/middleware/v2/resolveInstitution.js

# scopeGuard must check Superadmin bypass correctly:
grep -n "superadmin" apps/api/src/middleware/v2/scopeGuard.js

# modeGuard must reject 'managed' institutions on admin routes:
grep -n "managed\|403" apps/api/src/middleware/v2/modeGuard.js

# tokenVersion check must be present:
grep -n "tokenVersion" apps/api/src/middleware/v2/institutionAdminAuth.js
```

After Phase 2 completes: run `/cso` via gstack. See GSTACK.md for exact context to feed.

### Phase 3 (V1 Controllers) Review

```bash
# Check no password or jwt_token in any API response:
grep -rn "password\|jwt_token" apps/api/src/controllers/v1/ | grep -v "select\|bcrypt\|hash"
# Any hit = FIX IT

# Check every protected route has middleware:
grep -n "router\.\(get\|post\|put\|delete\)" apps/api/src/routes/v1/admin.js | grep -v "adminAuth\|login\|forgot"
# Only login/forgot should have no middleware

# Verify pagination is present on all list endpoints:
grep -rn "countDocuments\|pagination" apps/api/src/controllers/v1/admin/StudentController.js
```

### Phase 4 (Frontend) Review

```bash
# No hardcoded API URLs (must use env var):
grep -rn "localhost:4000\|api.maxmusic.com" apps/admin-panel/src/ | grep -v ".env"
# Expected: empty

# No localStorage for auth:
grep -rn "localStorage" apps/*/src/
# Expected: empty

# Check all forms have loading + error states:
grep -rn "isLoading\|error" apps/admin-panel/src/app/
```

### Phase 5 (V2 Controllers) — CRITICAL

```bash
# THE MOST IMPORTANT CHECK IN THE PROJECT:
# Every v2 controller MUST have institutionId in every query.

for file in apps/api/src/controllers/v2/institution/**/*.js; do
  echo "=== $file ==="
  grep -n "\.find\|\.findOne\|\.findOneAndUpdate\|\.updateMany\|\.deleteOne" "$file" | grep -v "institutionId"
  echo "---"
done

# Any non-empty output between === and --- = SECURITY BUG. Fix immediately.
```

Also run `/cso` again after Phase 5 — see GSTACK.md.

---

## TEST TEMPLATES

### Backend: Controller Unit Test

```javascript
// apps/api/src/__tests__/v1/admin/StudentController.test.js
const request = require('supertest');
const app = require('../../../server');

describe('StudentController (v1/admin)', () => {
  let adminToken;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/v1/admin/login')
      .send({ email: 'admin@maxmusic.com', password: 'changeme123' });
    adminToken = res.headers['set-cookie'];
  });

  describe('GET /api/v1/admin/students', () => {
    it('returns paginated student list', async () => {
      const res = await request(app)
        .get('/api/v1/admin/students')
        .set('Cookie', adminToken);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('pagination');
    });

    it('rejects unauthenticated requests', async () => {
      const res = await request(app).get('/api/v1/admin/students');
      expect(res.status).toBe(401);
    });
  });
});
```

### Isolation Test (Critical — write this for every v2 endpoint)

```javascript
// apps/api/src/__tests__/v2/isolation.test.js
describe('Multi-tenant isolation', () => {
  it('Institution A admin cannot see Institution B students', async () => {
    const res = await request(app)
      .get('/api/v2/inst/institution-a/admin/students')
      .set('Cookie', institutionAAdminToken);

    const studentIds = res.body.data.data.map(s => s._id);
    expect(studentIds).not.toContain(institutionBStudentId);
  });

  it('Managed mode institution cannot access admin routes', async () => {
    const res = await request(app)
      .get('/api/v2/inst/managed-institution/admin/students')
      .set('Cookie', managedInstitutionAdminToken);
    expect(res.status).toBe(403);
  });
});
```

---

## AFTER COMPLETING A REVIEW

1. Write a brief findings summary in tasks.md under the review row
2. Mark the review task ✅ if all clean, or ❌ with notes if fixes needed
3. If ❌, assign the fix to the appropriate agent and mark them 🔄
4. Only mark a phase complete when all its review tasks are ✅
