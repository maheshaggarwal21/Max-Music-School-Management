# Max Music School

A white-label, multi-tenant music-school management platform.

> 🚧 **Early development.** Architecture and planning are complete; implementation has not
> started yet. This repository will host the monorepo (Express API + Next.js panels).

## Status

| Area | State |
|------|-------|
| Architecture & data model | ✅ Planned |
| API contracts | ✅ Defined |
| Implementation | ⬜ Not started |

## Tech stack (planned)

- **Backend:** Node.js · Express · MongoDB (Mongoose)
- **Frontend:** Next.js 14 (App Router), one app per panel
- **Monorepo:** Turborepo
- **Auth:** JWT in httpOnly cookies
- **Payments:** Razorpay · **Email:** Nodemailer · **Realtime:** Socket.io
- **Infra:** Nginx · PM2

## Repository layout (planned)

```
apps/        Express API + Next.js panels
packages/    Shared UI, types, and utilities
```

## Getting started

Setup instructions will be added once the Phase 0 scaffold lands.

---

_Internal project notes and design docs are kept out of version control._
