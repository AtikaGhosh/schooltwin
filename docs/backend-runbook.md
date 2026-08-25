# Pilot backend runbook

## Prerequisites

- Node.js 20+, `pnpm@11.19.0`
- Supabase CLI (installed by `pnpm install`)
- Docker Desktop for the local Supabase stack and database tests
- Three Supabase projects: local, Mumbai staging, Mumbai production
- Supabase Team or higher before live pilot data
- Custom SMTP, approved legal/privacy/safety rules, and an incident response owner

Do not put real child data in any project until consent, privacy, safety, deletion, and incident-response approval is recorded.

## Local start

```bash
Copy-Item .env.example .env.local
pnpm backend:start
pnpm backend:reset
pnpm backend:types
pnpm dev
```

Use fictional accounts and schools locally. `supabase/seed.sql` contains only fictional Sundarpur data. The production project must start empty and be provisioned through `/admin`.

## Required secrets

Set separate random values in every environment:

- `ACCESS_GRANT_PEPPER`
- `DEVICE_TOKEN_PEPPER`
- `WORK_LEASE_SECRET`
- `INTERNAL_CRON_SECRET`
- Supabase secret key
- encrypted backup-bucket credentials

Set `ALLOWED_ORIGINS` to the exact HTTPS app origins. Never expose a secret through a `NEXT_PUBLIC_` variable or logs.

## Deploy in Mumbai

1. Create staging and production projects in `ap-south-1`.
2. Apply migrations in filename order; do not edit an applied migration.
3. Deploy every function under `supabase/functions`.
4. Add all secrets through Supabase secret management.
5. Configure scheduled invocations against the Mumbai function endpoint.
6. Set `NEXT_PUBLIC_SCHOOLTWIN_MODE=production` only in the production deployment.
7. Confirm the response header `x-schooltwin-region` reports the expected region.
8. Run Security Advisor and store the result with the release record.

## Provisioning order

1. Create the first `platform_admin` through a controlled bootstrap script or Supabase dashboard.
2. Insert the matching `profiles` row, sign in, and enrol authenticator MFA.
3. Open `/admin`; create a school, its 18 sections, facilities, markers, two evidence rules, and calendar.
4. Activate the school only after the database accepts the 18-section/two-rule check.
5. Invite a coordinator and school operators.
6. Create a ten-minute device code, pair the tablet, and set its local PIN.
7. Create and print participant pass batches. Plain passes are visible once. Confirm printing, seal cards, and destroy accidental copies.

## Daily checks

- `health` returns `ok`, current server time, active school count, and open alert count.
- The school-day job created 39 work items per open school.
- Retention, fingerprint, object mirror, and orphan cleanup jobs ran.
- No unresolved failed uploads or abnormal redemption-volume alerts exist.
- SMTP invitation and recovery delivery works.

Never log report text, answers, plaintext passes, capabilities, lease tokens, or signed links.

## Lost pass batch

1. Revoke the entire batch in `/admin`.
2. Print a replacement batch.
3. Record the operational reason without pass values or participant details.
4. Test one old pass; it must be rejected.

## Device loss or revocation

1. Revoke the device and every lease.
2. Sign the named operator out if account compromise is possible.
3. Do not trust locally queued work from the revoked device.
4. Pair a replacement with a new one-use code and new local PIN.

## Release checks

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:backend
pnpm test:integration
pnpm test:db
pnpm test:e2e
pnpm build
```

`pnpm test:db` and `pnpm backend:*` need Docker. A code-only pass is not a database pass.

For the staging-only 20-request redemption race, provision one unused pass,
set the five `SCHOOLTWIN_LIVE_*` values from `.env.example`, and run
`pnpm test:integration`. The test consumes that pass and is skipped when the
fixture is absent. Never aim this destructive concurrency fixture at production.

The restore command is the exception to the Docker note: it targets a newly
restored, network-isolated Supabase project and is documented in
`docs/restore-runbook.md`. It must never target local demo or live production.
