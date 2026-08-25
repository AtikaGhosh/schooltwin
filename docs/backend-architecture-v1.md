# SchoolTwin Pilot Backend Architecture v1.0

Status: frozen for pilot implementation on 25 August 2026.

## Boundary and authority

This backend serves the School Collection App only. It accepts observations and evidence. It does not score schools, infer fraud, create warnings, investigate, rank, or expose an Officials App.

> The server decides identity, access, work, time windows, accepted submissions, pass use, retention, and final task state. Data from a browser is only a claim until the server accepts it.

Edge Functions check the request and return small, safe responses. PostgreSQL transactions enforce the final rules. A secret backend key can call only narrow database functions; it is never sent to a browser.

## Services and region

- Supabase PostgreSQL, Auth, private Storage, Edge Functions, and scheduled jobs.
- Production and staging region: Mumbai (`ap-south-1`).
- Browser function calls explicitly use `FunctionRegion.ApSouth1`.
- Database- and Storage-heavy scheduled calls must use the Mumbai endpoint.
- Local, staging, and production use separate Supabase projects.

## Accounts and devices

Named email/password accounts have one system role: `platform_admin`, `field_coordinator`, or `school_operator`. Admins and coordinators need authenticator-app MFA (`aal2`). School membership is checked again inside every important database transaction.

A coordinator creates a random, one-use device-pairing code that expires after ten minutes. Pairing gives the device a random seven-day lease token; only its digest is stored by PostgreSQL. Sync refreshes that lease. Revocation or expiry blocks new work.

The six-digit local PIN is a salted Web Crypto digest. Five wrong tries cause a fifteen-minute local lock. It is a screen lock, not device proof.

## Daily work

`private.ensure_school_day()` is safe to run again. Database uniqueness rules keep one school day with exactly:

- 18 protected Daily Class Checks;
- 18 Class Videos;
- one operator Facility Check; and
- two selected Facility Videos.

Stored task states are `scheduled | in_progress | submitted | missed | failed`. “Available” is calculated from server time. Work started before closing may finish in the school’s completion grace period; the pilot default is five minutes.

## Participant passes

Printed passes are twelve random Crockford Base32 characters, shown once as `ABCD-EFGH-JKLM`. PostgreSQL stores only `HMAC-SHA-256(normalized pass, pepper)`. A pass is tied to one school, day, workflow, session, expiry, and successful redemption.

Redemption checks the session, paired device, school, IP digest, and short global failure volume. Expected denial results return a typed error so failed-attempt records commit instead of being rolled back. One atomic row lock makes concurrent redemption yield at most one success.

A successful redemption returns a random 256-bit capability. Only its SHA-256 digest is stored. Final submission validates and consumes that capability in the same transaction that writes one protected response. Partial protected answers are never sent or saved.

## Privacy

Protected Class Check and Student Private Check answers live in the unexposed `private` schema. Operators and coordinators receive only completion status and accepted time. `officials.officials_feed_v1` is an ungranted future observation contract, not an Officials App.

An ordinary private report stores only school, allowed category, text, school-local date, and deletion date. It stores no participant, pass, capability, session, section, device, operator, or exact application time. It creates no per-report submission or event. Daily operations may count private reports without exposing content.

Sensitive or immediate-safety content is rejected by the server and must be cleared by the client. This pilot does not guess sensitivity from free text and does not invent contact details. Platform and network logs may still have timing, so the product never promises guaranteed anonymity.

## Sync and offline work

Demo and production use different browser databases:

```text
schooltwin-prototype
schooltwin-production-cache
```

Only language and appearance preferences may cross that boundary. Production is selected by deployment configuration, never a user switch.

Operator mutations have UUID client IDs. PostgreSQL stores accepted receipts so a replay returns the first result without repeating side effects. The browser shows `Saved on this device → Waiting to send → Sending → Sent`, and never says “Submitted” before acceptance.

Offline operator forms and video work require an unexpired device lease, server
assignment where applicable, current configuration, and a narrow signed work
lease already cached on the device. The lease records the valid work period and
a separate 24-hour upload deadline. Participant redemption and submission
always require internet.

## Evidence

`capture-begin` checks the operator, membership, device lease, task, and server time; then returns the persisted challenge, unique private Storage path, and signed upload token. The browser records 10–60 continuous seconds, creates a SHA-256 fingerprint, and uses TUS with retry, resume, `x-signature`, and no overwrite.

`capture-finalize` checks the object path, size, media type, marker result, lease, mutation ID, and task state. PostgreSQL then creates the evidence, submission, event, and final task state atomically. A worker downloads the received bytes and records `pending | matched | failed`. “Matched” means the server received the same bytes, not that the scene is authentic.

Playback uses a fresh 60-second signed link. A successfully sent local recovery copy remains for up to seven days unless storage pressure removes it sooner. Unfinished uploads expire after 24 hours.

## Retention, backup, and restore

Defaults are 90 days for video and protected/private content, 365 days for permitted operational records and server events, and 30 days for failed pass attempts. Every protected row and object gets a `delete_after` value.

The encrypted Mumbai object mirror copies the same deletion date and may never
extend it. Database recovery residue is restricted to a maximum 14-day provider
backup window. A restored environment stays isolated while
`pnpm backend:restore-gate` removes expired data, runs primary/mirror object
retention, reapplies supplied revocations, checks the result, and records an
HMAC-signed restoration report.

## Code map

- `supabase/migrations/`: tables, row rules, transactions, schedules, and tests.
- `supabase/functions/`: small Mumbai-invoked service endpoints.
- `lib/schooltwin/backend/`: browser/server clients, production cache, sync, upload, and local PIN.
- `lib/schooltwin/repository/production.ts`: production-facing repository adapter.
- `app/admin/`: setup console with no protected-content access.
- `tests/backend/` and `supabase/tests/`: contract and database tests.

## Deferred

Officials App, AI, scores, confidence, Reality Gaps, rankings, warnings, investigations, escalation, biometrics, device attestation, and government integrations remain outside this backend.
