# ADRsimple full-stack MVP

## Stack
React + TypeScript + Vite frontend; Express + TypeScript API; PostgreSQL + Prisma ORM.

## Features
- Working routes: login, registration, dashboard, matter list, create matter, matter detail.
- Password-based authentication with bcrypt and JWT in HttpOnly cookie.
- Matter creation and creator-only access.
- Retrospective onboarding for ongoing proceedings.
- Historical events with actual event date distinct from system entry timestamp.
- Current procedural stage can be updated independently.
- Pending directions, event timeline and audit events.
- Responsive interface.

## Local setup
Requirements: Node 20+, PostgreSQL 15+, npm.

1. Create PostgreSQL database `adrsimple`.
2. In `server`, copy `.env.example` to `.env`, set DATABASE_URL and a random JWT_SECRET (32+ characters).
3. Run:
   `npm install`
   `npx prisma generate`
   `npx prisma migrate dev --name init`
   `npm run dev`
4. In another terminal, in `client`, run:
   `npm install`
   `npm run dev`
5. Open http://localhost:5173. API health: http://localhost:4000/api/health

## Use
Register -> sign in -> Create matter. Choose “During ongoing proceedings” to enter the appointment date, current stage, prior hearings/orders/minutes and pending directions. Historical events are sorted by event date. Their createdAt timestamp records when they were entered into the system. Add further events from the matter page and update the current stage.

## Deployment
Deploy a managed PostgreSQL database and the Node API to a Node-compatible host. Set DATABASE_URL, JWT_SECRET, CLIENT_ORIGIN, NODE_ENV=production and COOKIE_SECURE=true as host secrets. Run `npx prisma migrate deploy` during release. Build client with `npm run build` and deploy `client/dist` to static hosting. Configure HTTPS and exact CORS origin. Prefer same-site frontend/API domains or a reverse proxy.

## Not production-certified
This is a functional MVP foundation, not a security-certified production system. Do not enter confidential live case material until:
- MFA, email verification, password reset, rate limiting and CSRF protection are implemented.
- Private encrypted object storage replaces local file storage.
- File malware scanning, signature validation and authenticated download permissions are implemented.
- Matter invitations, tribunal/party/advocate roles and granular access controls are implemented and tested.
- Cross-matter isolation, audit integrity, backups/restore, retention and incident response are tested.
- Independent security testing and India-specific privacy/confidentiality/legal review are completed.

The current API restricts matter access to its creator. It does not yet implement invitations or shared participant access. File upload/download is intentionally not exposed in this starter; use a private storage service in production. No institutional rules, payments, notifications or AI decisions are included.
