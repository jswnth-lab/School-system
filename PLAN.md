# School Management SaaS: Plan

## REVISION 3 2026-10-03: Supabase Postgres + Cloudflare Workers/R2, workers.dev domain. Supersedes Revision 1+2 DB/isolation parts.
- **DB**: one Supabase project (Postgres), shared by all schools. `school_id` on every tenant table + **RLS** (as in the original plan). Reason: Supabase free = 2 projects per org, so per-school projects are not possible. D1 dropped.
- **Access**: Drizzle + `postgres` over Supavisor transaction pooler from Workers (`nodejs_compat`). Per request: transaction + `set_config('app.school_id', ..., true)`. App connects as a non-owner role without BYPASSRLS. Supabase Auth/PostgREST/Realtime not used by app code (API-only access), so also revoke `anon`/`authenticated` grants on app tables.
- **Keep-alive**: Supabase free pauses after ~7 days idle. Workers Cron Trigger runs `select 1` daily.
- **Files**: R2 stays (presigned). **Compute**: one Hono Worker = API + portal static assets. Per-school Worker/R2 dropped for now (shared bucket, key prefix `{school_id}/`).
- **Domain**: `*.workers.dev` for now (no wildcard subdomains), so tenant is a path segment: portal `/{school}/...`, API `/api/v1/{school}/...`. Mobile builds bake slug. Move to `{brand}.jswnth.com` later: needs jswnth.com nameservers on Cloudflare, or a CNAME per school at Spaceship (no wildcard SSL via Workers without CF DNS).
- Repo layout: `apps/api` (Worker), `apps/portal` (Vite React), `packages/db`.
- Env: `apps/api/.dev.vars` (runtime + migrations). Prod via `wrangler secret put`.

## REVISION 2 2026-10-03: stack per school, domain jswnth.com
- **Isolation by physical separation**: each school = own D1 database + R2 bucket + Worker (API + portal) + domain `{brand}.jswnth.com`. No shared tenant tables. RLS not needed. Drop `school_id` columns and `tenantDb()` scoping (single-school schema). Supersedes Revision 1 "Tenant isolation".
- **Control plane** (one Worker + its own D1 at `platform.jswnth.com`): tenant registry, plans, billing, provisioning, build jobs, platform super-admin. Only place that knows all schools.
- **Provisioning** (Cloudflare API, triggered from control plane): create D1, create R2 bucket, apply migrations, deploy Worker from the shared codebase with generated wrangler config + secrets, attach route/custom domain, seed principal account.
- **Releases**: one codebase; release = migrate + deploy every school stack (script loops registry; canary school first; per-school version pinned in registry).
- **Mobile**: white-label build per school points at `https://{brand}.jswnth.com/api/v1` (no tenant header needed).
- **Free-tier fit**: free account caps (verify): 10 D1 databases, 100 Workers, 1000 R2 buckets, limits are per account, daily request/write caps are per account too, not per school. About 9 schools max on free, usable for dev/pilot only. Paid plan lifts to 50,000 D1 DBs.
- Cross-school analytics: control plane pulls aggregates via each school's API. No cross-DB queries.

## REVISION 2026-10-03: Cloudflare D1 + R2 (free tier). Supersedes Postgres/RLS/Next.js/Vercel parts below.
- **DB**: D1 (SQLite) via Drizzle `drizzle-orm/d1`. Migrations by `wrangler d1 migrations`.
- **Files**: R2 (presigned URLs, direct client upload). No egress fees.
- **API**: Hono on Cloudflare Workers at `/api/v1`. Same zod + OpenAPI + typed client in `packages/contracts`.
- **Web portal**: Vite + React SPA (React Router, TanStack Query) served by Workers static assets. Replaces Next.js: Next via OpenNext likely exceeds the 3 MB compressed free-Worker size limit and 10 ms CPU cap. One Worker = API + portal = still "one website".
- **Tenant isolation**: D1 has no RLS. Shared DB, `school_id` on every row. Enforced by one rule: all queries go through `tenantDb(schoolId)` helper (adds `school_id` filter/value); raw `db` import banned by lint. Cross-tenant test in CI (miniflare/`wrangler dev --local`). Per-school D1 databases rejected: free plan caps at 10 databases.
- **Auth**: Better Auth with D1 adapter (Drizzle). KV optional for rate limits.
- **Jobs**: Cron Triggers + Queues (fee reminders, notification fan-out, CSV import). PDFs: client-side or Browser Rendering later.
- **Email**: Resend. **Push**: Expo Push. Unchanged.
- **Hosting/CI**: Wrangler deploy from GitHub Actions. Subdomain per school via wildcard route `*.yourapp.com`.
- **Free-tier ceilings** (verify current limits before committing): Workers 100k req/day, 10 ms CPU; D1 5 GB total, 5M reads + 100k writes/day, max 10 DBs; R2 10 GB, 1M writes + 10M reads/month. Fine for dev + pilot. Production SaaS needs Workers Paid (about $5/mo) before school #2: daily write cap breaks attendance/marks at 1 school of 1000 students.
- D1 gotchas: no `SET LOCAL`, no row-level policy, 100 bound params per query (chunk bulk imports), 10 GB per DB hard cap, SQLite types (store money as integer minor units, dates as ISO text/int).

## Context
Multi-tenant SaaS for schools. Each school gets its own branding.
- **1 web app**: API server + principal/admin portal + platform super-admin. Next.js.
- **2 Expo apps**: Teacher, Student (Parent mode lives in Student app).
- Decisions made: **white-label EAS build per school**, **Next.js + Postgres + Drizzle monorepo**, v1 = academics + communication + fees + parent access.
- Greenfield, directory `/media/jashu/4B998B2225A36AEF/Work/monos/sms` is empty.
- User message was cut off ("framework ... with the schools branding -"). Re-check for missing framework/doc before building.

## Roles
| Role | Surface |
|---|---|
| Platform owner (you) | Web `/platform`: tenants, plans, billing, builds |
| School owner / principal | Web portal |
| Admin staff (accountant, registrar) | Web portal, permission-scoped |
| Teacher | Teacher app + web (read) |
| Student | Student app |
| Parent | Student app "family mode" (switch child) + web later |

RBAC: role + permission table per school. Role checks in API layer, not UI.

## Architecture
```
sms/
  apps/
    web/          Next.js App Router: portal UI + /api/v1 (Hono)
    teacher/      Expo (expo-router)
    student/      Expo (expo-router)
  packages/
    db/           Drizzle schema, migrations, RLS SQL, seed
    contracts/    zod schemas + OpenAPI + typed client (shared by web and Expo)
    app-core/     shared RN code: auth, api hooks, theming, push, offline queue
    tenant-config/ tenant branding schema + loader
    config/       tsconfig, eslint
  tenants/<slug>.json   white-label inputs (name, bundle ids, icon, splash, colors)
  tools/build-tenant.ts   one command: build a branded app for a school
```
- Turborepo + pnpm. TypeScript everywhere.
- **API**: Hono mounted in a Next route handler at `/api/v1`. zod validators, generated OpenAPI, typed client in `contracts`. Versioned REST because old store binaries live forever.
- **DB**: Postgres (Neon via Vercel Marketplace). Shared schema, `school_id` on every tenant table.
- **Tenant isolation**: Postgres RLS. Each request runs `SET LOCAL app.school_id = ...` in a transaction. Policy `school_id = current_setting('app.school_id')`. App DB role has no BYPASSRLS. Add a test that cross-tenant reads return zero rows.
- **Tenant resolve**: web via subdomain `slug.yourapp.com` (custom domain later). Mobile via `school_id` baked into build, sent as header.
- **Auth**: Better Auth (email+password, phone/email OTP for parents/students, Expo plugin for token sessions). Sessions scoped to one school. Students without email: admin-issued username + temp password.
- **Files**: private object storage (R2/S3 or Vercel Blob private) with signed URLs. Direct client upload (4.5 MB function body limit).
- **Jobs**: Vercel Queues/Workflow (or Inngest) for reports, bulk imports, fee reminders, notification fan-out.
- **Email**: Resend. **Push**: Expo Push Service, per-tenant credentials (see below).
- **Realtime**: not v1. Push + pull-to-refresh. Chat is async threads.
- **i18n**: i18next from day one. RTL-ready layouts (Arabic likely).
- **Observability**: Sentry (web + both apps), per-tenant tag. Audit log table for grade/fee/attendance edits.

## White-label build pipeline
Runtime theming still loads from `GET /api/v1/tenant/config` (colors, logo, name), so most branding changes ship over-the-air. Build-time branding only covers what stores require: app name, icon, splash, bundle id, scheme.
1. Platform portal "New school" creates `tenants/<slug>.json` and tenant row.
2. `tools/build-tenant.ts <slug> <teacher|student>` sets `TENANT=slug`. `app.config.ts` reads it for name, bundleIdentifier/package, icon, splash, `extra.schoolId`.
3. EAS build profile per run, EAS Update channel `slug-prod` for OTA.
4. CI (GitHub Actions) matrix triggered from the platform portal. Build status shown there.
5. EAS Submit to stores.

**Risk to settle before school #1:** Apple guideline 4.2.6 rejects apps made from a commercial template unless submitted by the content provider. Mitigation: publish each branded app under the school's own Apple Developer / Play account (you hold delegated access), or fall back to the shared app. Also costs: $99/yr Apple + $25 Play per school, review time per release, FCM/APNs keys per school. Price this into plans (white-label = premium add-on with setup fee).
Keep shared-app mode working from the same code (school-code entry screen) as the fallback and for trials/demos.

## Domain model (core tables, all with `school_id`)
- Identity: `school`, `user`, `membership(role)`, `parent_student_link`, `device_token`
- Structure: `academic_year`, `term`, `grade_level`, `section`, `subject`, `class_subject_teacher`, `room`
- People: `student`, `teacher`, `guardian`, `enrollment`
- Time: `timetable_slot`, `holiday`, `event`
- Attendance: `attendance_session`, `attendance_record` (present/absent/late/excused)
- Academics: `assignment`, `submission`, `assessment`, `grade_scale`, `mark`, `report_card`
- Communication: `announcement`, `message_thread`, `message`, `notification`, `notification_pref`
- Fees: `fee_structure`, `fee_item`, `invoice`, `invoice_line`, `payment`, `discount`
- Platform: `plan`, `subscription`, `tenant_domain`, `build_job`, `audit_log`

## Feature scope v1
**Web portal (principal/admin)**: school setup wizard (branding, year, terms, grades, subjects), bulk CSV import of students/teachers/guardians, class and timetable builder, attendance reports, grade/report-card publish, announcements, fee structures + invoicing + payment tracking + receipts, user/role management, audit log, analytics dashboard.
**Teacher app**: today's timetable, take attendance (offline queue, sync later), create/grade assignments, enter marks, message parents/classes, announcements, leave request.
**Student app**: timetable, attendance, assignments + submit files, grades/report cards, announcements, events calendar. **Parent mode**: child switcher, fee invoices + pay, attendance alerts, message teacher.
**Platform (super-admin)**: tenants, plans, usage, impersonate-with-audit, build jobs, feature flags per school.

## SaaS billing (two separate money flows, do not mix)
1. **You charge schools**: Stripe Billing, per-student/month tiers (e.g. Starter / Standard / White-label). Usage = active students. Trial, dunning, plan limits enforced in API (`plan` checks middleware).
2. **Schools charge parents** (fees): payment gateway with marketplace/payout support so money goes to the school, not you (Stripe Connect or a regional gateway). Region still unknown, **decide gateway before M5**. Webhooks idempotent, invoices immutable once issued (adjust via credit notes).

## Compliance and security
- Student data = minors. Plan for FERPA/GDPR/COPPA-style rules: data processing agreement, per-school export and delete, retention settings, parental consent flow.
- Encrypted at rest (provider), TLS, private files, rate limiting, audit log, backups with tested restore, 2FA for admins, no cross-tenant data in logs.
- Penetration-style test of RLS and role checks before first paying school.

## Milestones
| # | Deliverable | Exit check |
|---|---|---|
| M0 | Monorepo, CI, DB + RLS skeleton, Better Auth, tenant resolve, deploy to Vercel | Two seeded schools, cross-tenant test passes |
| M1 | Portal: school setup, users/roles, structure, CSV import | Principal can onboard a school end to end |
| M2 | Teacher + Student apps shell: login, tenant theming, nav, push registration | Same binary shows School A / B branding by code |
| M3 | Attendance + timetable (web + teacher + student) | Teacher marks attendance offline, parent sees alert |
| M4 | Assignments, marks, report cards | Report card PDF published, visible in app |
| M5 | Announcements + messaging | Push delivered per tenant |
| M6 | Fees: invoices, parent pay, receipts, reports | Test-mode payment settles to school account |
| M7 | SaaS billing, plans, platform console | Self-serve signup + trial + upgrade |
| M8 | White-label pipeline + first branded store release | Branded app on TestFlight and Play internal |
| M9 | Hardening: audit, backups, load test, i18n/RTL, pilot school | Pilot live, SLO + alerts in place |

## Open decisions (before related milestone)
- Target region/currency, payment gateway (M6).
- Apple/Google account ownership per school (M8).
- Parent web portal in v1 or later.
- Pricing numbers.

## Verification
- `pnpm test`: unit + API integration tests against a local Postgres (RLS cross-tenant test is mandatory in CI).
- `pnpm dev`: web at localhost; Expo apps via `expo start` against local API, run on device/simulator with two tenants (`TENANT=a`, `TENANT=b`) and confirm different branding.
- E2E: Playwright for portal critical flows (onboard school, import CSV, publish report card, create invoice).
- Maestro for mobile flows (login, take attendance, pay invoice).
- Stripe/gateway test mode + webhook replay for fee and subscription flows.
- `eas build --profile tenant-a` produces installable build with school name/icon.
