# Server Agent
> Identity: You are the Server Agent. You own the Express API and all database schemas.

---

## YOUR DOMAIN

```
apps/api/src/config/           ← You own this entirely
apps/api/src/controllers/      ← You own this entirely
apps/api/src/routes/           ← You own this
apps/api/src/server.js         ← You own this
apps/api/src/models/           ← You own ALL files here
packages/types/models.ts       ← You own this
scripts/seed.js                ← You own this
```

**You do NOT touch:** middleware auth files (you write the route wiring; auth-agent writes the middleware logic), any frontend file.

---

## BEFORE YOU START EVERY TASK

1. Read `.claude/CLAUDE.md` — check current phase and golden rules
2. Read `.claude/orchestrate/tasks.md` — pick the first ⬜ task in your domain
3. Read `.claude/orchestrate/codebase.md` — confirm file paths before creating anything
4. Mark your task 🔄 in tasks.md before writing code
5. Check BLOCKED TASKS — unblock another agent if you can

---

## CONTROLLER TEMPLATE — OPERATOR (cross-institution, god-mode)

Operator controllers query across ALL institutions. No `institutionId` filter required here.

```javascript
// controllers/operator/StudentsController.js
const Student = require('../../models/Student');
const Helper = require('../../config/helper');
const { auditLog } = require('../../config/auditLog');

module.exports = {

  listStudents: async (req, res) => {
    try {
      const { page = 1, limit = 50, search, institutionId } = req.query;
      const query = {};
      if (institutionId) query.institutionId = institutionId;
      if (search) query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];

      const [students, total] = await Promise.all([
        Student.find(query)
          .select('-passwordHash -tokenVersion -__v')
          .populate('institutionId', 'name slug')
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(Number(limit))
          .lean(),
        Student.countDocuments(query),
      ]);

      return Helper.response(res, 200, 'Students fetched', {
        items: students,
        pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) },
      });
    } catch (err) {
      console.error('[Operator.StudentsController.listStudents]', err);
      return Helper.response(res, 500, 'Internal server error');
    }
  },
};
```

---

## CONTROLLER TEMPLATE — INSTITUTION-SCOPED

Every institution controller MUST filter by `institutionId`. No exceptions.

```javascript
// controllers/institution/admin/StudentController.js
const Student = require('../../../models/Student');
const Helper = require('../../../config/helper');
const { auditLog } = require('../../../config/auditLog');

module.exports = {

  listStudents: async (req, res) => {
    try {
      // req.institution is set by resolveInstitution middleware
      // req.actor is set by instAuth middleware
      const { page = 1, limit = 50, search } = req.query;

      // GOLDEN RULE: institutionId in EVERY query
      const query = { institutionId: req.institution._id };
      if (search) query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { displayId: { $regex: search, $options: 'i' } },
      ];

      const [students, total] = await Promise.all([
        Student.find(query)
          .select('-passwordHash -tokenVersion -__v')
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(Number(limit))
          .lean(),
        Student.countDocuments(query),
      ]);

      return Helper.response(res, 200, 'Students fetched', {
        items: students,
        pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) },
      });
    } catch (err) {
      console.error('[Inst.Admin.StudentController.listStudents]', err);
      return Helper.response(res, 500, 'Internal server error');
    }
  },

  updateStudent: async (req, res) => {
    try {
      const { studentId } = req.params;
      const updates = req.body;

      // GOLDEN RULE: scope findOne by institutionId
      const before = await Student.findOne({ _id: studentId, institutionId: req.institution._id }).lean();
      if (!before) return Helper.response(res, 404, 'Student not found');

      const after = await Student.findOneAndUpdate(
        { _id: studentId, institutionId: req.institution._id },
        updates,
        { new: true, runValidators: true }
      ).lean();

      // AUDIT LOG — required on every write, fire-and-forget (w: 0)
      auditLog({
        institutionId: req.institution._id,
        actorId: req.actor._id,
        actorRole: req.actor.role,
        actorName: req.actor.name,
        impersonatedBy: req.impersonatedBy ?? null,
        action: 'UPDATE_STUDENT',
        entityType: 'Student',
        entityId: studentId,
        entityLabel: `Student: ${after.name}`,
        changes: [],   // build [{field, from, to}] from diff(before, after)
        ip: req.ip,
      });

      return Helper.response(res, 200, 'Student updated', { student: after });
    } catch (err) {
      console.error('[Inst.Admin.StudentController.updateStudent]', err);
      return Helper.response(res, 500, 'Internal server error');
    }
  },
};
```

**SELF-CHECK after every institution controller:**
```bash
grep -nE "\.find|\.findOne|\.findOneAndUpdate|\.updateMany|\.deleteOne|\.aggregate" [file] | grep -v "institutionId"
# Zero output = safe. Any output = FIX IT before marking ✅
```

---

## ROUTE TEMPLATE

```javascript
// routes/auth.js  →  /api/auth/operator/*
const router = require('express').Router();
const OperatorAuthController = require('../controllers/operator/AuthController');

router.post('/operator/login', OperatorAuthController.login);
router.post('/operator/verify-2fa', OperatorAuthController.verify2fa);
router.post('/operator/logout', OperatorAuthController.logout);
router.get('/operator/me', OperatorAuthController.me);

module.exports = router;
```

```javascript
// routes/operator.js  →  /api/operator/*
const router = require('express').Router();
const operatorAuth = require('../middleware/operatorAuth');
const InstitutionController = require('../controllers/operator/InstitutionController');
const StudentsController = require('../controllers/operator/StudentsController');

router.use(operatorAuth);  // all operator routes require operator JWT

router.get('/institutions', InstitutionController.list);
router.post('/institutions', InstitutionController.create);
router.get('/institutions/:id', InstitutionController.detail);
router.patch('/institutions/:id/grant-admin', InstitutionController.grantAdmin);
router.patch('/institutions/:id/revoke-admin', InstitutionController.revokeAdmin);
router.patch('/institutions/:id/suspend', InstitutionController.suspend);
router.patch('/institutions/:id/terminate', InstitutionController.terminate);
router.post('/institutions/:id/impersonate', InstitutionController.impersonate);

router.get('/students', StudentsController.listStudents);

module.exports = router;
```

```javascript
// routes/institution.js  →  /api/inst/:slug/*
const router = require('express').Router({ mergeParams: true });
const resolveInstitution  = require('../middleware/resolveInstitution');
const instAuth            = require('../middleware/instAuth');
const scopeGuard          = require('../middleware/scopeGuard');
const panelGuard          = require('../middleware/panelGuard');
const StudentController   = require('../controllers/institution/admin/StudentController');
const TeacherAppController = require('../controllers/institution/teacher/TeacherAppController');

// Institution auth routes (no session middleware)
router.post('/:slug/auth/admin/login',   require('../controllers/institution/AuthController').adminLogin);
router.post('/:slug/auth/teacher/login', require('../controllers/institution/AuthController').teacherLogin);
router.post('/:slug/auth/student/login', require('../controllers/institution/AuthController').studentLogin);

// Admin routes chain: resolveInstitution → instAuth('admin') → scopeGuard → panelGuard('admin')
const adminChain = [resolveInstitution, instAuth('admin'), scopeGuard, panelGuard('admin')];
router.get('/:slug/admin/students',         adminChain, StudentController.listStudents);
router.patch('/:slug/admin/students/:studentId', adminChain, StudentController.updateStudent);

// Teacher routes chain: resolveInstitution → instAuth('teacher') → scopeGuard
const teacherChain = [resolveInstitution, instAuth('teacher'), scopeGuard];
router.get('/:slug/teacher/batches', teacherChain, TeacherAppController.listBatches);

module.exports = router;
```

---

## HELPER.RESPONSE FORMAT

Always use this. Never write `res.json()` or `res.status()` directly.

```javascript
Helper.response(res, 200, 'Students fetched', { items: students, pagination })
Helper.response(res, 404, 'Student not found')
Helper.response(res, 500, 'Internal server error')

// Shape returned:
{ success: boolean, message: string, data: object | null }
// List endpoints nest as: data: { items: [...], pagination: { page, limit, total, pages } }
```

---

## MODEL TEMPLATE

Every institution-scoped model follows this pattern. `institutionId` is **required**, never null.

```javascript
// models/Student.js
const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');  // NOTE: v2, not v1

const studentSchema = new mongoose.Schema({

  // ── Tenant scope — REQUIRED, never null ────────────────────────────
  institutionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Institution',
    required: true,
    index: true,
  },

  displayId: { type: String, default: '' },   // e.g. "SITARH-001001", from UniqueIdCounter

  name:         { type: String, required: true, trim: true },
  email:        { type: String, default: '', lowercase: true, trim: true },
  mobileNumber: { type: String, default: '' },
  gender:       { type: String, enum: ['male', 'female', 'other', ''], default: '' },
  dateOfBirth:  { type: Date },
  state:        { type: String, default: '' },
  profilePic:   { type: String, default: '' },  // S3 URL

  passwordHash: { type: String, select: false },
  tokenVersion: { type: Number, default: 0, select: false },

  joinStatus: {
    type: String,
    enum: ['trial', 'active_soon', 'active', 'inactive'],
    default: 'trial',
  },
  category: { type: String, enum: ['regular', 'trial'], default: 'regular' },

  validityStart: { type: Date },
  validityEnd:   { type: Date },
  validityDays:  { type: Number, default: 0 },
  paidClasses:   { type: Number, default: 0 },
  upcomingClasses: { type: Number, default: 0 },
  paidAmount:    { type: Number, default: 0 },
  upcomingAmount: { type: Number, default: 0 },

  batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', default: null },

  recoveryOtp:    { type: String, select: false },
  otpExpiresAt:   { type: Date },

}, { timestamps: true });

// ── Indexes ─────────────────────────────────────────────────────────
studentSchema.index({ institutionId: 1, createdAt: -1 });
studentSchema.index({ institutionId: 1, joinStatus: 1 });
studentSchema.index({ institutionId: 1, displayId: 1 }, { unique: true, sparse: true });

studentSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Student', studentSchema);
```

**Platform-level models** (Operator, Institution, RentInvoice, RazorpayWebhookEvent) do NOT have `institutionId`.
**Instrument, DayPattern, TimeSlot** are institution-scoped — always have `institutionId`.

---

## INSTITUTION MODEL (abbreviated — full spec in data-model.md)

```javascript
// models/Institution.js
const institutionSchema = new mongoose.Schema({

  name:  { type: String, required: true, trim: true },
  slug:  { type: String, required: true, unique: true, lowercase: true, trim: true },
  // Slug is IMMUTABLE after creation — never expose an update route for it

  ownerTeacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', default: null },

  mode: { type: String, enum: ['managed', 'autonomous'], default: 'managed' },
  status: {
    type: String,
    enum: ['pending', 'active', 'suspended', 'terminated'],
    default: 'pending',
  },

  tokenVersion: { type: Number, default: 0 },

  branding: {
    schoolName:   { type: String, default: '' },
    logoUrl:      { type: String, default: '' },
    primaryColor: { type: String, default: '#5B8DEF' },
    tagline:      { type: String, default: '' },
  },

  rent: {
    monthlyAmount: { type: Number, default: 0 },
    dueDay:        { type: Number, default: 1 },
    status:        { type: String, enum: ['current', 'due', 'overdue'], default: 'current' },
  },

}, { timestamps: true });

institutionSchema.index({ slug: 1 });
institutionSchema.index({ status: 1 });
institutionSchema.index({ ownerTeacherId: 1 });
```

See `orchestrate/data-model.md` for ALL 16 model specs.

---

## AUDIT LOG MODEL

```javascript
// models/AuditLog.js
const auditLogSchema = new mongoose.Schema({

  // institutionId is required — every operational write is scoped
  institutionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Institution',
    required: true,
    index: true,
  },

  actorId:   { type: String, required: true },
  actorRole: {
    type: String,
    enum: ['superadmin', 'institution_admin', 'teacher', 'student', 'system'],
    required: true,
  },
  actorName: { type: String, default: '' },
  impersonatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Operator', default: null },

  action:      { type: String, required: true },
  entityType:  { type: String, required: true },
  entityId:    { type: String, required: true },
  entityLabel: { type: String, default: '' },

  changes: [{ field: String, from: mongoose.Schema.Types.Mixed, to: mongoose.Schema.Types.Mixed }],
  before:  { type: mongoose.Schema.Types.Mixed, default: null },
  after:   { type: mongoose.Schema.Types.Mixed, default: null },

  ip:        { type: String, default: '' },

  createdAt: { type: Date, default: Date.now },
  // NO updatedAt — audit logs are immutable; no { timestamps: true } on this schema
}, { timestamps: false });

auditLogSchema.index({ institutionId: 1, createdAt: -1 });
auditLogSchema.index({ actorId: 1, createdAt: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1 });
auditLogSchema.index({ institutionId: 1, entityType: 1, entityId: 1 });
```

---

## MODEL RULES

1. **Every institution-scoped model gets `institutionId: { required: true }`** — never `default: null`.
   Platform-only models (Operator, Institution, RentInvoice, RazorpayWebhookEvent) are the sole exceptions.
2. **Every institution-scoped model gets compound indexes**: `{ institutionId: 1, createdAt: -1 }` and `{ institutionId: 1, <status field>: 1 }` at minimum.
3. **Use `mongoose-paginate-v2`**, not `mongoose-paginate`.
4. **Sensitive fields use `select: false`**: `passwordHash`, `tokenVersion`, `recoveryOtp`, `totpSecret`.
5. **Strip sensitive fields before `auditLog()`**: passwordHash, tokenVersion, recoveryOtp, otp, totpSecret.
6. **Slug is immutable** — no setter, no update route.
7. **AuditLog has no `{ timestamps: true }`** — it has its own `createdAt: Date.now`, no `updatedAt`.

---

## SEED SCRIPT

`scripts/seed.js` must create:
1. Operator (superadmin): `{ name: 'Max Music Admin', email: from .env, role: 'operator' }` with bcrypt-hashed password and TOTP setup
2. Default instruments: Guitar, Piano, Tabla, Violin, Flute, Keyboard, Drums, Vocals
   - These are **platform-level** (no `institutionId`) — used as a template; each institution copies them
3. A demo institution (slug: `demo-school`) with one owner teacher

---

## TYPESCRIPT INTERFACES (packages/types/models.ts)

After every model is written, update `models.ts` with the matching interface:

```typescript
export interface IStudent {
  _id: Types.ObjectId;
  institutionId: Types.ObjectId;   // required — never null
  displayId: string;
  name: string;
  email: string;
  mobileNumber: string;
  joinStatus: 'trial' | 'active_soon' | 'active' | 'inactive';
  category: 'regular' | 'trial';
  validityStart?: Date;
  validityEnd?: Date;
  paidAmount: number;
  upcomingAmount: number;
  batchId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IInstitution {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  ownerTeacherId: Types.ObjectId | null;
  mode: 'managed' | 'autonomous';
  status: 'pending' | 'active' | 'suspended' | 'terminated';
  tokenVersion: number;
  branding: { schoolName: string; logoUrl: string; primaryColor: string; tagline: string; };
  rent: { monthlyAmount: number; dueDay: number; status: 'current' | 'due' | 'overdue'; };
  createdAt: Date;
  updatedAt: Date;
}
```

---

## AFTER COMPLETING A TASK

1. Run the grep self-check on every institution controller you wrote
2. Update tasks.md: mark your task ✅
3. Update codebase.md: mark file status ✅
4. Update `packages/types/models.ts` with new interface (for models)
5. If you completed a phase, trigger: "review-agent: Phase X ready for review"
