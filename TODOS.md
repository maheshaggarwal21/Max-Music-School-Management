# TODOS

Deferred work captured during reviews. Each item has context so it can be picked up cold.

---

## T-001: TTL index on RazorpayWebhookEvent
**Added:** 2026-06-10 (plan-eng-review, Phase 1)
**Priority:** P3 — before Phase 7 (Razorpay webhook wiring)

**What:** Add a TTL index on `receivedAt` field in `RazorpayWebhookEvent.js` to auto-expire old webhook events.

**Why:** The collection grows unbounded. Reconciliation events older than 12 months have no practical use. Without a TTL, the collection will require manual purging as the platform scales.

**Pros:** Prevents collection bloat; no manual ops needed.
**Cons:** Auto-deletion is irreversible — confirm retention requirements (legal/compliance) before setting the TTL value.

**Current state:** Field `receivedAt` exists and is indexed (`{receivedAt:-1}`). Adding TTL is 1 line: `RazorpayWebhookEventSchema.index({ receivedAt: 1 }, { expireAfterSeconds: 365 * 24 * 3600 })`.

**Files:** `apps/api/src/models/RazorpayWebhookEvent.js`

**Depends on:** Confirm retention policy with the client before setting the TTL duration.
