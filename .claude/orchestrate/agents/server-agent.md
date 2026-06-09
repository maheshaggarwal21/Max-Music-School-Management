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

**You do NOT touch:** middleware auth files (you write the wiring, auth-agent writes the logic), any frontend file.

---

## BEFORE YOU START EVERY TASK

1. Read `.claude/CLAUDE.md` — check current phase and golden rules
2. Read `.claude/orchestrate/tasks.md` — pick the first ⬜ task in your domain
3. Read `.claude/orchestrate/codebase.md` — confirm file paths before creating anything
4. Mark your task 🔄 in tasks.md before writing code
5. Check BLOCKED TASKS — unblock another agent if you can

---

## CONTROLLER TEMPLATE

Every controller follows this exact structure. No exceptions.

```javascript
// controllers/v1/admin/StudentController.js
const Student = require('../../../models/StudentModel');
const Helper = require('../../../config/helper');
const { auditLog } = require('../../../config/auditLog');

module.exports = {

  getStudents: async (req, res) => {
    try {
      const { page = 1, limit = 50, search } = req.query;
      const query = { status: { $ne: 'deleted' } };
      if (search) query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];

      const [students, total] = await Promise.all([
        Student.find(query)
          .select('-password -jwt_token -__v')
          .sort({ _id: -1 })
          .skip((page - 1) * limit)
          .limit(Number(limit))
          .lean(),
        Student.countDocuments(query)
      ]);

      return Helper.response(res, 200, 'Students fetched successfully', {
        data: students,
        pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) }
      });
    } catch (err) {
      console.error('[StudentController.getStudents]', err);
      return Helper.response(res, 500, 'Internal server error');
    }
  },

  updateStudent: async (req, res) => {
    try {
      const { _id, ...updates } = req.body;
      const before = await Student.findById(_id).lean();
      if (!before) return Helper.response(res, 404, 'Student not found');

      const after = await Student.findByIdAndUpdate(_id, updates, { new: true, runValidators: true }).lean();

      // AUDIT LOG — required on every write
      await auditLog({
        institutionId: null,   // null = main school
        actorId: req.admin._id,
        actorRole: 'superadmin',
        action: 'UPDATE_STUDENT',
        entityType: 'student',
        entityId: _id,
        before,
        after,
        ip: req.ip,
      });

      return Helper.response(res, 200, 'Student updated', { student: after });
    } catch (err) {
      console.error('[StudentController.updateStudent]', err);
      return Helper.response(res, 500, 'Internal server error');
    }
  },
};
```

---

## V2 CONTROLLER TEMPLATE (institution-scoped)

For every v2 institution controller, the query pattern is different:

```javascript
// controllers/v2/institution/admin/StudentController.js
const Student = require('../../../../models/StudentModel');
const Helper = require('../../../../config/helper');
const { auditLog } = require('../../../../config/auditLog');

module.exports = {

  getStudents: async (req, res) => {
    try {
      // req.institution is set by resolveInstitution middleware
      // req.actor is set by institutionAdminAuth middleware
      const { page = 1, limit = 50 } = req.query;

      // GOLDEN RULE: institutionId in EVERY query
      const query = {
        institutionId: req.institution._id,
        status: { $ne: 'deleted' }
      };

      const [students, total] = await Promise.all([
        Student.find(query).select('-password -jwt_token -__v').sort({ _id: -1 })
          .skip((page - 1) * limit).limit(Number(limit)).lean(),
        Student.countDocuments(query)
      ]);

      return Helper.response(res, 200, 'Students fetched', {
        data: students,
        pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) }
      });
    } catch (err) {
      console.error('[Inst.StudentController.getStudents]', err);
      return Helper.response(res, 500, 'Internal server error');
    }
  },
};
```

**SELF-CHECK after every v2 controller:**
```bash
grep -n "\.find\|\.findOne\|\.findOneAndUpdate\|\.updateMany\|\.deleteOne" [file] | grep -v "institutionId"
# Zero output = safe. Any output = FIX IT before marking ✅
```

---

## ROUTE TEMPLATE

```javascript
// routes/v1/admin.js
const router = require('express').Router();
const adminAuth = require('../../middleware/v1/adminAuth');
const StudentController = require('../../controllers/v1/admin/StudentController');

// Auth routes (no middleware)
router.post('/login', AdminController.login);

// Protected routes
router.get('/students', adminAuth, StudentController.getStudents);
router.put('/students', adminAuth, StudentController.updateStudent);
router.delete('/students/:id', adminAuth, StudentController.deleteStudent);

module.exports = router;
```

```javascript
// routes/v2/institution.js
const router = require('express').Router();
const resolveInstitution = require('../../middleware/v2/resolveInstitution');
const institutionAdminAuth = require('../../middleware/v2/institutionAdminAuth');
const scopeGuard = require('../../middleware/v2/scopeGuard');
const modeGuard = require('../../middleware/v2/modeGuard');
const StudentController = require('../../controllers/v2/institution/admin/StudentController');

const adminChain = [resolveInstitution, institutionAdminAuth, scopeGuard, modeGuard('autonomous')];

router.get('/:slug/admin/students', adminChain, StudentController.getStudents);
router.put('/:slug/admin/students', adminChain, StudentController.updateStudent);

module.exports = router;
```

---

## HELPER.RESPONSE FORMAT

Always use this. Never write `res.json()` or `res.status()` directly.

```javascript
Helper.response(res, 200, 'Students fetched', { data: students, pagination })
Helper.response(res, 404, 'Student not found')
Helper.response(res, 500, 'Internal server error')

// Shape returned:
{ success: boolean, message: string, data: object | null }
```

---

## MODEL TEMPLATE

Every model follows this exact structure:

```javascript
// models/StudentModel.js
const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate');
mongoose.set('debug', false);

const studentSchema = new mongoose.Schema({

  // ── Core fields ────────────────────────────────────────────────────
  institutionId: {              // NULL = main school, ObjectId = institution tenant
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Institution',
    default: null,
    index: true,
  },

  name:   { type: String, default: '', trim: true },
  email:  { type: String, default: '', lowercase: true, trim: true },
  mobileNumber: { type: String, default: '' },
  alternativeMobileNumber: { type: String, default: '' },
  gender: { type: String, enum: ['male', 'female', ''], default: '' },
  dateOfBirth: { type: Date },
  state:  { type: String, default: '' },

  password:  { type: String, default: '' },        // bcrypt hash only
  jwt_token: { type: String, default: '' },         // current active token

  profilePic: { type: String, default: '' },        // S3 URL

  status: {
    type: String,
    enum: ['active', 'inactive', 'deleted'],
    default: 'active',
  },

  uniqueId: { type: String, default: '' },          // e.g. "106928" or "SITARH-001001"

  // ── Relations ────────────────────────────────────────────────────
  requestId:           { type: mongoose.Schema.Types.ObjectId, ref: 'Request' },
  lastClassId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
  allAssignedClassIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Class' }],
  suitableDays:        { type: mongoose.Schema.Types.ObjectId, ref: 'DayPattern' },
  suitableTime:        { type: mongoose.Schema.Types.ObjectId, ref: 'TimeSlot' },

  // ── Password reset ───────────────────────────────────────────────
  temporaryKey:           { type: String },
  temporaryKeyExpiration: { type: Date },
  otp:                    { type: Number },

  createdDate: { type: Date, default: Date.now },
  updatedDate: { type: Date, default: Date.now },
}, {
  timestamps: { createdAt: 'createdDate', updatedAt: 'updatedDate' },
});

// ── Indexes ────────────────────────────────────────────────────────
studentSchema.index({ institutionId: 1, createdDate: -1 });  // paginated list
studentSchema.index({ institutionId: 1, status: 1 });         // filtered list
studentSchema.index({ email: 1 });
studentSchema.index({ mobileNumber: 1 });
studentSchema.index({ uniqueId: 1 });

studentSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Student', studentSchema);
```

---

## INSTITUTION MODEL

```javascript
// models/InstitutionModel.js
const institutionSchema = new mongoose.Schema({

  name:   { type: String, required: true, trim: true },
  slug:   { type: String, required: true, unique: true, lowercase: true, trim: true },
  // slug is IMMUTABLE after creation. e.g. "sitar-house-delhi"

  ownerTeacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', default: null },
  createdBySaasAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },

  mode: { type: String, enum: ['managed', 'autonomous'], default: 'managed' },
  status: {
    type: String,
    enum: ['pending', 'active', 'suspended', 'terminated'],
    default: 'pending',
  },

  tokenVersion: { type: Number, default: 0 },

  plan: {
    type: { type: String, enum: ['trial', 'basic', 'pro'], default: 'trial' },
    startDate:    { type: Date },
    renewalDate:  { type: Date },
    billingCycle: { type: String, enum: ['monthly', 'annual'], default: 'monthly' },
    paidAmount:   { type: Number, default: 0 },
  },

  branding: {
    schoolName:   { type: String, default: '' },
    logoUrl:      { type: String, default: '' },
    primaryColor: { type: String, default: '#e91e8c' },
    tagline:      { type: String, default: '' },
  },

  adminCredentialsDeliveredAt:   { type: Date, default: null },
  teacherCredentialsDeliveredAt: { type: Date, default: null },

  createdDate: { type: Date, default: Date.now },
  updatedDate: { type: Date, default: Date.now },
});

institutionSchema.index({ slug: 1 });
institutionSchema.index({ status: 1 });
institutionSchema.index({ ownerTeacherId: 1 });
```

---

## AUDIT LOG MODEL

```javascript
// models/AuditLogModel.js
const auditLogSchema = new mongoose.Schema({

  institutionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Institution',
    default: null,
  },

  actorId:   { type: String, required: true },
  actorRole: {
    type: String,
    enum: ['superadmin', 'institution_admin', 'teacher', 'student', 'system', 'cron'],
    required: true,
  },
  actorName: { type: String, default: '' },

  action:     { type: String, required: true },
  entityType: { type: String, required: true },
  entityId:   { type: String, required: true },

  before: { type: mongoose.Schema.Types.Mixed, default: null },
  after:  { type: mongoose.Schema.Types.Mixed, default: null },

  ip:        { type: String, default: '' },
  userAgent: { type: String, default: '' },
  note:      { type: String, default: '' },

  createdDate: { type: Date, default: Date.now },
  // NO updatedAt — audit logs are immutable once written
});

auditLogSchema.index({ institutionId: 1, createdDate: -1 });
auditLogSchema.index({ actorId: 1, createdDate: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1 });
auditLogSchema.index({ institutionId: 1, entityType: 1, entityId: 1 });
```

---

## MODEL RULES

1. **Every model gets `institutionId`** (except AdminModel, ContactModel, RazorpayWebhookModel).
2. **Every model gets compound indexes**: `{ institutionId: 1, createdDate: -1 }` and `{ institutionId: 1, status: 1 }` at minimum.
3. **Never remove existing fields.** Add only.
4. **Passwords are stored as bcrypt hashes only.** Never store plaintext.
5. **Strip sensitive fields before auditLog()**: password, jwt_token, temporaryKey, otp.
6. **UniqueIdModel needs a `prefix` field** and compound index `{ institutionId: 1, type: 1 }`.

---

## SEED SCRIPT

`scripts/seed.js` must create:
1. Superadmin: `{ email: 'admin@maxmusic.com', password: 'changeme123', role: 'superadmin' }`
2. Default instruments: Guitar, Piano, Tabla, Violin, Flute, Keyboard, Drums, Vocals (all `institutionId: null`)
3. Default day patterns: `[Mon-Wed-Fri]`, `[Tue-Thu-Sat]`, `[Mon-Tue-Wed-Thu-Fri-Sat]`
4. Default time slots: 30-minute windows from 6AM to 10PM (all `institutionId: null`)
5. UniqueId records: `{ type: 'student', prefix: '', lastuniqueId: '100000', institutionId: null }` and `{ type: 'teacher', ... }`

---

## TYPESCRIPT INTERFACES (packages/types/models.ts)

After every model is written, update `models.ts` with the matching interface:

```typescript
export interface IStudent {
  _id: Types.ObjectId;
  institutionId: Types.ObjectId | null;
  name: string;
  email: string;
  mobileNumber: string;
  status: 'active' | 'inactive' | 'deleted';
  uniqueId: string;
  requestId?: Types.ObjectId;
  createdDate: Date;
  updatedDate: Date;
}

export interface IInstitution {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  ownerTeacherId: Types.ObjectId | null;
  mode: 'managed' | 'autonomous';
  status: 'pending' | 'active' | 'suspended' | 'terminated';
  tokenVersion: number;
  plan: { type: 'trial' | 'basic' | 'pro'; startDate?: Date; renewalDate?: Date; };
  branding: { schoolName: string; logoUrl: string; primaryColor: string; };
  createdDate: Date;
}
```

---

## AFTER COMPLETING A TASK

1. Run the grep self-check on every v2 controller you wrote
2. Update tasks.md: mark your task ✅
3. Update codebase.md: mark file status ✅
4. Update packages/types/models.ts with the new interface (for models)
5. If you completed a phase, trigger: "review-agent: Phase X ready for review"
