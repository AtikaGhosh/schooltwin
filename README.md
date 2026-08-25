# SchoolTwin School Collection App

The operator experience is an action-first bilingual daily work assistant:
“Here is what you need to do today. Do the next thing.” Visible language is
simple English or Odia; participant answers, credentials, and private report
content remain hidden from the operator.

SchoolTwin now has two deliberately separate deployment modes. Demo mode is a local-only, fictional workspace. Production mode uses the pilot Supabase backend for named accounts, paired devices, server-created work, one-use participant passes, protected responses, offline operator queues, resumable private video upload, retention, and audit events. Fictional demo records are never copied into production.

Core rule:

> Collection mechanisms collect observations, not conclusions.

This repository does not implement the future Officials App. It contains no school performance scoring, confidence engine, Reality Gap analysis, ranking, warning, investigation, or escalation UX.

## Run locally

Requirements: Node.js 20+, `pnpm@11.19.0`, and latest Chrome/Chromium.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The fictional Sundarpur Government High School workspace is already paired and `/` redirects to `/home`.

Live Evidence requires HTTPS or localhost and camera permission. Participant demo credentials and the complete demonstration sequence are in [`docs/demo-runbook.md`](docs/demo-runbook.md).

## Architecture

- Next.js 16 App Router with separate operator and restricted kiosk layouts
- IndexedDB schema v5 through `idb`, behind a versioned `SchoolTwinRepository`
- Separate structured records and binary capture-blob stores
- Replaceable browser adapters for clock, entropy, challenges, capture, marker scanning, hashing, and storage quota
- Explicit operator/kiosk privacy projections
- Five-day, relative Sundarpur coverage seed and complete local Demo Reset
- Supabase PostgreSQL/Auth/private Storage/Edge Functions in the production path
- PostgreSQL transactions as the final rule and privacy boundary
- Separate `schooltwin-prototype` and `schooltwin-production-cache` browser databases
- Mumbai-pinned function calls and TUS resumable video uploads

The School app design is documented in [`docs/school-collection-architecture.md`](docs/school-collection-architecture.md). The backend is frozen in [`docs/backend-architecture-v1.md`](docs/backend-architecture-v1.md); setup and recovery instructions are in [`docs/backend-runbook.md`](docs/backend-runbook.md) and [`docs/restore-runbook.md`](docs/restore-runbook.md).

## Validate

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

## Integrity limitations

Demo mode uses local challenges, time, codes, evidence, and events; IndexedDB is not a security boundary. Production mode moves authority, credentials, time, acceptance, and storage to the server. In both modes an evidence fingerprint only compares bytes. It does not prove what happened in front of the camera, physical presence, immutability, or tamper resistance. The independent Officials analysis system remains future work.
