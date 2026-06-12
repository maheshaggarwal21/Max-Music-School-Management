# Data Model — Every Schema
> Reference spec for all Mongoose models. Field-level, no implementation code.
> Conventions below apply to every model unless noted. Contracts: ../CONTRACTS.md

---

## CONVENTIONS (apply to all models)

- **Timestamps:** every model has `createdAt` / `updatedAt` (Mongoose `timestamps: true`),
  EXCEPT `AuditLog` which has only `createdAt` (immutable).
- **Institution scope:** every *institution-scoped* model has
  `institutionId: ObjectId → Institution` — **required, indexed** — plus the two compound
  indexes `{institutionId, createdAt:-1}` and `{institutionId, status}` (where a `status`
  field exists).
- **Platform-level models** (NO `institutionId`): `Operator`, `Institution`, `RentInvoice`,
  `RazorpayWebhookEvent`.
- **Secrets** (`passwordHash`, `recoveryOtp`, `jwt_token`) are `select:false`
  and never returned in API responses or audit logs.
- **Money** is stored in integer paise (INR) or as a Decimal — never float. Display formats
  via packages/utils.
- **Soft delete:** prefer `status` transitions over hard deletes for auditable entities.

Legend: `*` required · `?` optional · `→` ref · `[]` array · `{}` subdocument · `enum(...)`.

---

# PLATFORM-LEVEL MODELS

## Operator  (the superadmin / client)
| field | type | notes |
|---|---|---|
| name* | String | |
| email* | String | unique, lowercased |
| passwordHash* | String | bcrypt, `select:false` |
| role* | enum(`superadmin`) | only value for now |
| mobile? | String | for OTP login; `select:false` not needed |
| mobileVerified | Boolean | default false; gates OTP login |
| tokenVersion | Number | default 0; bump to force re-login |
| lastLoginAt? | Date | |

Indexes: `{email}` unique.

---

## Institution  (the tenant container)
| field | type | notes |
|---|---|---|
| name* | String | "ABC Music School" |
| slug* | String | unique, immutable, URL-safe (lowercase + hyphens) |
| mode* | enum(`managed`,`autonomous`) | billing source of truth |
| status* | enum(`pending`,`active`,`suspended`,`terminated`) | default `pending` |
| ownerTeacherId? | ObjectId → Teacher | the lead teacher (set after owner created) |
| createdByOperatorId* | ObjectId → Operator | |
| contactEmail* | String | for credential / notice delivery |
| branding* | {} | `{ schoolName, logoUrl?, primaryColor (default #5B8DEF), tagline? }` |
| rent? | {} | autonomous only: `{ amount, billingCycle enum(monthly), nextDueDate }` |
| tokenVersion | Number | default 0; bump on suspend / mode toggle (institution-wide logout) |
| activatedAt? / suspendedAt? / terminatedAt? | Date | lifecycle stamps |

Indexes: `{slug}` unique · `{status}` · `{mode}` · `{ownerTeacherId}`.
Rule: **slug is never updatable.** `mode` is mutated only via the grant/revoke action (which
also edits the owner's `panelAccess`).

---

## RentInvoice  (autonomous institution → Max Music; operator revenue)
| field | type | notes |
|---|---|---|
| institutionId* | ObjectId → Institution | (platform-level view, but references the inst) |
| period* | String | e.g. `2026-06` |
| amount* | Number | |
| dueDate* | Date | |
| status* | enum(`pending`,`paid`,`overdue`) | default `pending` |
| paidAt? | Date | |
| reference? | String | manual txn note / Razorpay id if used |
| markedByOperatorId? | ObjectId → Operator | who marked paid |

Indexes: `{institutionId, period}` unique · `{status, dueDate}`.

---

## RazorpayWebhookEvent  (raw reconciliation feed; not auto-attributed)
| field | type | notes |
|---|---|---|
| institutionId? | ObjectId → Institution | best-effort tag (by teacher link), may be null |
| eventType* | String | `payment.captured`, `payment.failed`, … |
| paymentId? | String | Razorpay payment id |
| amount? | Number | |
| contact? | String | payer phone/email from payload |
| payerName? | String | |
| status? | String | captured / failed |
| rawPayload* | {} | full event body |
| receivedAt* | Date | |

Indexes: `{paymentId}` · `{receivedAt:-1}` · `{institutionId, receivedAt:-1}`.

---

# INSTITUTION-SCOPED MODELS

## Teacher  (also the institution-admin identity via PBAC)
| field | type | notes |
|---|---|---|
| institutionId* | ObjectId → Institution | |
| displayId* | String | per-institution sequence (e.g. `100023`) |
| name* | String | |
| email* | String | unique within institution |
| mobile* | String | |
| altMobile? | String | |
| gender? | enum(`male`,`female`) | |
| dob? | Date | |
| profilePicUrl? | String | |
| razorpayPaymentLink? | String | where THIS teacher's students pay |
| isOwner | Boolean | default false; true for the institution's lead teacher |
| panelAccess* | [enum(`teacher`,`admin`)] | PBAC; default `['teacher']`. `admin` ⇒ can log into admin panel |
| employmentType | enum(`salary`,`rent`) | derived from institution mode; `rent` only meaningful for owner |
| salaryAmount? | Number | managed mode (what Max pays) |
| performance? | Number | denormalized rating (display) |
| kpiPercent? | Number | denormalized (display) |
| passwordHash* | String | `select:false` |
| recoveryOtp? | String | `select:false` |
| tokenVersion | Number | default 0; bump on grant/revoke/password-reset (single-user logout) |
| status* | enum(`active`,`inactive`) | default `active` |
| lastLoginAt? | Date | |

Indexes: `{institutionId, createdAt:-1}` · `{institutionId, status}` ·
`{institutionId, email}` unique · `{institutionId, isOwner}`.

> The admin login authenticates against `Teacher` and requires `panelAccess` to include
> `admin`. Same record, two panels.

---

## Student
| field | type | notes |
|---|---|---|
| institutionId* | ObjectId → Institution | |
| displayId* | String | per-institution sequence (e.g. `106928`) |
| teacherId? | ObjectId → Teacher | assigned teacher |
| batchId? | ObjectId → Batch | one batch per student (MVP) |
| name* | String | |
| mobile* | String | |
| email? | String | |
| gender? | enum(`male`,`female`) | |
| profilePicUrl? | String | |
| instrumentId? | ObjectId → Instrument | |
| classLevelId? | ObjectId → ClassLevel | snapshotted at enrollment; pre-fills feeTotal + validityDays |
| classType? | String | e.g. "Class 1" |
| mode | enum(`online`,`offline`) | default `online` |
| joinStatus* | enum(`trial`,`active_soon`,`active`,`inactive`) | lifecycle (cron-advanced) |
| sessionType | enum(`live`,`all`) | default `all` |
| category | enum(`regular`,`trial`) | default `regular` |
| validityStart? / validityEnd? | Date | the paid window |
| validityDays? | Number | e.g. 60 |
| paidClasses | Number | default 0 |
| upcomingClasses | Number | default 0 |
| paidAmount | Number | default 0 — fee collected (visible to operator + admin) |
| upcomingAmount | Number | default 0 — fee due next cycle |
| feeTotal | Number | default 0 — total committed fee (paise), snapshot from ClassLevel at enrollment |
| paymentStatus* | enum(`unpaid`,`partial`,`paid`,`free`) | default `unpaid`; **DERIVED** via `config/payments.derivePaymentStatus` on every write — never client-set. `remainingAmount` is computed in serializers, never stored |
| remarks? | String | free-text admin note |
| assignedVideoChapterId? | ObjectId | reserved (video deferred) |
| requestId? | ObjectId → EnrollmentRequest | source request |
| recoveryOtp? | String | `select:false` |
| passwordHash? | String | `select:false`; student-panel login |
| tokenVersion | Number | default 0 |
| status* | enum(`active`,`inactive`,`hold`) | default `active`. **`hold`** = manually paused (e.g. partial payment): still logs in (auth denies only `inactive`) and the validity-expiry cron skips it |

Indexes: `{institutionId, createdAt:-1}` · `{institutionId, status}` ·
`{institutionId, joinStatus}` · `{institutionId, paymentStatus}` · `{institutionId, teacherId}` ·
`{institutionId, batchId}` · `{institutionId, validityEnd}` (cron expiry sweep) ·
`{institutionId, displayId}` unique.

---

## EnrollmentRequest  ("New Requests" tab)
| field | type | notes |
|---|---|---|
| institutionId* | ObjectId → Institution | |
| name* | String | |
| mobile* | String | |
| email? | String | |
| preferredDayPatternId? | ObjectId → DayPattern | |
| preferredTimeSlotId? | ObjectId → TimeSlot | |
| instrumentId? | ObjectId → Instrument | |
| status* | enum(`pending`,`approved`,`rejected`) | default `pending` |
| paymentStatus | enum(`unpaid`,`paid`) | default `unpaid` |
| proposed? | sub-doc (no _id) | full Add-Student form config carried by a structured request; `approve()` consumes it as **defaults** (the approval form overrides). Fields: classLevelId, teacherId, batchId, instrumentId, classType, mode, sessionType, joinStatus, category, gender, validityStart/End/Days, feeTotal, paidAmount, paidClasses, upcomingClasses, remarks. All refs cleaned via refGuard at create (foreign/invalid dropped, never thrown). `paymentStatus` NOT carried — always re-derived at student creation |
| approvedStudentId? | ObjectId → Student | set on approval |
| handledBy? | { actorId, actorRole } | who approved/rejected |

Indexes: `{institutionId, createdAt:-1}` · `{institutionId, status}`.

---

## Batch
| field | type | notes |
|---|---|---|
| institutionId* | ObjectId → Institution | |
| name* | String | auto-encoded, e.g. `Vari 7:00-8:00 PM (TTS) ON` |
| instrumentId? | ObjectId → Instrument | |
| dayPatternId? | ObjectId → DayPattern | |
| timeSlotId? | ObjectId → TimeSlot | |
| teacherId? | ObjectId → Teacher | null ⇒ "Setting Phase" |
| mode | enum(`online`,`offline`) | default `online` |
| studentCount | Number | denormalized, kept in sync on assign/unassign |
| status* | enum(`setting`,`active`,`inactive`,`archived`) | default `setting` |

Indexes: `{institutionId, createdAt:-1}` · `{institutionId, status}` ·
`{institutionId, teacherId}`.

---

## DayPattern  ("Suitable Days")
| field | type | notes |
|---|---|---|
| institutionId* | ObjectId → Institution | |
| days* | [enum(`mon`..`sun`)] | e.g. `['mon','wed','fri']` |
| label | String | derived display, e.g. "Mon-Wed-Fri" |
| isActive | Boolean | default true (the Active/Disabled toggle) |

Indexes: `{institutionId, isActive}`. Unique: `{institutionId, days}` (no duplicate patterns).

## TimeSlot  ("Suitable Times")
| field | type | notes |
|---|---|---|
| institutionId* | ObjectId → Institution | |
| startTime* | String | `"HH:mm"` 24h |
| endTime* | String | `"HH:mm"` |
| label | String | derived, e.g. "7:00 PM - 8:00 PM" |
| isOnline | Boolean | default true (the Online toggle) |

Indexes: `{institutionId, isOnline}`. Unique: `{institutionId, startTime, endTime}`.

## Instrument
| field | type | notes |
|---|---|---|
| institutionId* | ObjectId → Institution | seeded per institution from an operator master list |
| name* | String | "Guitar", "Sitar"… |
| isActive | Boolean | default true |
| fromCatalog | Boolean | default false. **true** ⇒ materialized from the operator GLOBAL catalog (`PlatformSettings.instruments`). `GET /admin/instruments` self-heals these to mirror the catalog (create/reactivate when added, deactivate — never delete — when removed). `fromCatalog:false` (institution-specific/seeded) rows are never touched |

Indexes: `{institutionId, name}` unique.

---

## ClassLevel  (reusable fee+duration template — admin "Class" tab)
| field | type | notes |
|---|---|---|
| institutionId* | ObjectId → Institution | |
| name* | String | e.g. "Beginner", "3-Month" |
| paidAmount | Number | default 0 (paise) — default already-paid amount |
| upcomingAmount* | Number | (paise) total class fee → pre-fills student `feeTotal` |
| days* | Number | validity duration in days → pre-fills student `validityDays` |
| isActive | Boolean | default true |

Selecting a level on enrollment/approval pre-fills the student's feeTotal + validity (+ default paid).
**Never hard-deleted while referenced** by a student (`CLASS_LEVEL_IN_USE` 400) — deactivate via isActive.
Indexes: `{institutionId, name}` unique · `{institutionId, isActive}`.
Audit actions: `CREATE_CLASS_LEVEL`, `UPDATE_CLASS_LEVEL` (delete also logged as UPDATE w/ `{deleted:true}`).

---

## Attendance
| field | type | notes |
|---|---|---|
| institutionId* | ObjectId → Institution | |
| batchId* | ObjectId → Batch | |
| studentId* | ObjectId → Student | |
| teacherId? | ObjectId → Teacher | who taught/marked |
| date* | Date | the class date (day granularity) |
| status* | enum(`present`,`absent`,`holiday`,`credited`) | |
| markedBy | { actorId, actorRole } | |

Indexes: `{institutionId, batchId, date}` · `{institutionId, studentId, date}`.
Unique: `{studentId, batchId, date}` (one mark per student per session per day).

## Holiday
| field | type | notes |
|---|---|---|
| institutionId* | ObjectId → Institution | |
| batchId* | ObjectId → Batch | |
| date* | Date | |
| studentCategory* | enum(`regular`,`trial`) | which students get a class credited |
| reason? | String | |
| creditsApplied | Boolean | default false (set true once classes credited) |
| createdBy | { actorId, actorRole } | |

Indexes: `{institutionId, batchId, date}` · `{institutionId, date}`.

---

## Payment  (student fee record — manual + reconciliation)
| field | type | notes |
|---|---|---|
| institutionId* | ObjectId → Institution | |
| studentId* | ObjectId → Student | |
| teacherId? | ObjectId → Teacher | the receiving teacher |
| type* | enum(`fee`,`admission`) | |
| period? | String | e.g. `2026-06` |
| amount* | Number | |
| status* | enum(`paid`,`overdue`,`partial`,`free`) | |
| method | enum(`razorpay`,`manual`,`cash`) | default `manual` |
| razorpayPaymentId? | String | links to RazorpayWebhookEvent for reconciliation |
| paidAt? | Date | |
| recordedBy | { actorId, actorRole } | |

Indexes: `{institutionId, createdAt:-1}` · `{institutionId, status}` ·
`{institutionId, studentId}` · `{razorpayPaymentId}`.

---

## AuditLog  (immutable — powers Changes History + per-student activity feed)
| field | type | notes |
|---|---|---|
| institutionId* | ObjectId → Institution | |
| actorId* | String | |
| actorRole* | enum(`superadmin`,`institution_admin`,`teacher`,`student`,`system`) | |
| actorName* | String | denormalized for fast display |
| impersonatedBy? | ObjectId → Operator | set when superadmin acted via god-token |
| action* | String | `CREATE_STUDENT`, `UPDATE_PAID_AMOUNT`, `TOGGLE_MODE`, `APPROVE_REQUEST`… |
| entityType* | String | `student`,`teacher`,`batch`,`request`,`payment`,`institution`,`day_pattern`,`time_slot`,`attendance`,`holiday` |
| entityId* | String | |
| entityLabel? | String | denormalized, e.g. "Student: Arti Thakur" |
| changes? | [{ field, from, to }] | renders "PAID AMOUNT changed from 0 to 6000" |
| before? / after? | {} | optional full snapshot, secrets stripped |
| ip? | String | |
| createdAt* | Date | **no updatedAt — immutable** |

Indexes: `{institutionId, createdAt:-1}` · `{institutionId, entityType, entityId, createdAt:-1}`
(per-entity feed) · `{institutionId, action}` · `{actorRole}`.
Written with `{ w: 0 }`. Never updated/deleted.

---

## UniqueIdCounter  (display-ID sequences)
| field | type | notes |
|---|---|---|
| institutionId* | ObjectId → Institution | |
| entityType* | enum(`student`,`teacher`) | |
| seq | Number | last issued; atomically `$inc`'d |
| start? | Number | per-institution starting value (e.g. students 106000, teachers 100000) |

Unique: `{institutionId, entityType}`.

---

# DEFERRED MODELS (reserve the names; do NOT build in MVP)
`VideoChapter`, `VideoSession`, `StudentVideoProgress`, `Certificate`, `Announcement`,
`TrialCallLog`, `Notification`, `FeeReminder`, `ClassReminder`. Each will be institution-scoped
and follow the conventions above when built.

---

# RELATIONSHIP SUMMARY
```
Operator ──creates──> Institution
Institution ──owns(ownerTeacherId)──> Teacher (isOwner, panelAccess includes 'admin' if autonomous)
Institution ──has many──> Teacher, Student, Batch, DayPattern, TimeSlot, Instrument,
                          EnrollmentRequest, Attendance, Holiday, Payment, AuditLog
Teacher ──teaches──> Batch (1 teacher : many batches)
Batch ──composed of──> Instrument + DayPattern + TimeSlot
Batch ──has many──> Student (1 student : 1 batch, MVP)
EnrollmentRequest ──approved into──> Student
Student ──has many──> Attendance, Payment
Holiday ──credits classes to──> Students of a Batch (by category)
Institution(autonomous) ──billed via──> RentInvoice
Teacher's Razorpay link ──captures──> RazorpayWebhookEvent (reconciliation only)
Every write ──emits──> AuditLog (filtered per-entity for the student activity feed)
```
