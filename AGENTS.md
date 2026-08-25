<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# SchoolTwin project rules

## Product boundary

This repository implements **SchoolTwin School Collection App only**. It is a
collection product for recording operational observations from a monitored
school. It has an isolated fictional demo mode and a pilot Supabase production
mode. A future Officials App will perform analysis, confidence
scoring, Reality Gap detection, investigation, verification, and escalation.

The governing product rule is:

> Collection mechanisms collect observations, not conclusions.

Do not add inspector, district, state, ranking, analytical school-health,
Reality Gap, confidence-score, warning, investigation, or escalation UX to this
application. Do not infer fraud, poor performance, authenticity, or dishonesty
from collected observations.

The collection product has four distinct channels:

1. mandatory daily Class School Pulse for every one of the 18 sections;
2. mandatory daily Live Class Evidence for every section plus selected facility
   evidence;
3. random private Student Pulse, hidden from operators; and
4. attributed operator or private student operational reporting.

The primary operator question is whether every section supplied today’s required
observations. Missing records use neutral operational wording and never imply
risk, fault, warning, or escalation.

## Prototype truthfulness

The prototype may demonstrate in-app camera recording, a continuous
MediaRecorder session, marker observation, locally issued challenges, local
timestamps, SHA-256 evidence fingerprints, single-use demo codes, and local
persistence.

Never describe frontend-only mechanisms as server verified, immutable,
tamper-resistant, securely attested, guaranteed anonymous, authenticated
reality, proof of physical presence, or impossible to manipulate.

Approved language includes:

- Recorded continuously in this SchoolTwin session.
- Expected classroom marker observed.
- Local capture timestamp recorded.
- Evidence fingerprint generated.
- Prototype integrity checks completed.

## Privacy

- `KioskSession` represents a restricted device workflow. `AccessGrant` is a
  separate opaque, hashed, single-use participant credential.
- Valid participant codes must not appear in normal operator navigation or UI.
- Product components receive explicit privacy projections, never raw IndexedDB
  records.
- Operator projections must not contain Pulse answers, participant/code
  references, private-report content, or hidden analytical output.
- Class School Pulse answers are protected. Operators may see only assignment
  completion status and submission time, never structured answers or monitor
  credentials.
- Private Student Pulse exposes only `inactive | active | completed` to the
  operator, with no response counts or answers.
- Private student reports must not appear in operator submission history.
- Sensitive or immediate-safety report content must not be persisted. Clear the
  draft and show protected-channel guidance without inventing contact details.
- IndexedDB cannot provide a genuine security boundary against a person who
  controls the browser and developer tools. State that limitation clearly.

## Architecture

- Use real Next.js App Router routes and separate operator and kiosk layouts.
- Keep browser APIs behind replaceable adapters: `CaptureService`,
  `MarkerScanner`, `BlobHasher`, `StorageQuotaService`, `Clock`, `IdGenerator`,
  `EntropySource`, and `ChallengeGenerator`.
- Keep IndexedDB behind a versioned `SchoolTwinRepository`. Components must not
  call IndexedDB directly.
- Maintain explicit IndexedDB upgrade migrations. Do not delete the database to
  handle domain-model changes.
- The v4 daily-coverage stores preserve v3 captures, submissions, private Pulse
  data, and read-only legacy class observations. New section observations write
  only to Class Pulse stores.
- Store binary capture blobs separately from structured records.
- Derive task availability from the injected clock and task window. Do not
  persist `available` as a task status.
- Standard daily collection windows derive from each school's configured time
  zone, opening time, and closing time. Do not add short routine windows or a
  “Later today” queue. Before opening show “Not open yet”; during school hours
  show “Do now”; after closing show “Not done”. Keep the configured completion
  grace only for work started before closing.
- Time-restricted surprise verification belongs to the future Officials App
  and is not part of this School Collection prototype.
- Keep `schooltwin-prototype` and `schooltwin-production-cache` separate. Never
  copy fictional demo records, passes, evidence, or events into production.
- Use TypeScript strict typing. Do not bypass modeling with `any`.

## Experience and accessibility

- Desktop uses the operator sidebar; mobile uses bottom navigation.
- Class School Pulse, private Student Pulse, and private-report routes use a
  stripped-down kiosk layout with no operator navigation or submission access.
- Support keyboard navigation, visible focus, semantic headings, accessible
  dialogs and form errors, text in addition to color, adequate touch targets,
  and reduced-motion preferences.
- The supported Live Evidence demo environment is latest Chrome/Chromium over
  HTTPS or localhost with camera permission enabled. Show clear compatibility
  errors elsewhere.

## Quality and operating procedure

Before framework-sensitive work, read the relevant installed Next.js 16 guide
under `node_modules/next/dist/docs/`.

Implement migration phases sequentially. After every phase run and fix:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

Preserve unrelated user changes. A feature is complete only when its behavior,
privacy boundary, loading/empty/error states, responsiveness, accessibility,
tests, and production build have been validated. Report genuine limitations;
do not claim unexecuted validation passed.

## Action-first bilingual UX rules

> **School-side screens are designed around actions, not the underlying data model. Domain terminology must not automatically become UI terminology.**

> **If a user can complete a workflow without understanding what “Digital Twin”, “evidence artifact”, “sampling”, “operational observation”, or “prototype integrity” means, prefer that simpler interface.**

- Design primary workflows for touch first, with at least 48px targets, one
  primary action per screen, and one question per guided step.
- Use plain English and natural spoken Odia. Primary operator, kiosk,
  validation, error, privacy, and accessibility strings must not be left
  untranslated.
- Keep technical and integrity metadata outside primary actions, normally in
  expandable details.
- Derive daily work totals from assignments and tasks. Never hard-code progress
  counts in product components.
- Map `en` to `en-IN` and `or` to `or-IN` for document language and formatting.
- Demo Reset preserves the operator's language preference.

SchoolTwin should visually feel like a premium public-infrastructure operations
product: calm, trustworthy, minimal, high-legibility, and purposeful. It should
not resemble a generic admin template, school ERP, government portal, consumer
social app, or analytics dashboard. Every screen should have one obvious
primary action. Use whitespace, typography, and hierarchy before adding cards,
borders, or decoration.

Optimize visual design for shared 8–11 inch Android tablets first, desktop
second, and small phones third. Use icons as functional cues, reserve the
primary accent for current focus and primary actions, keep status colors muted,
and keep purposeful motion below roughly 200ms with reduced-motion support.

## Pilot backend rules

> The server is authoritative for identity, access, assignments, time windows,
> submission acceptance, pass consumption, retention, and final task state.
> Client data is a claim until PostgreSQL accepts it.

- Edge Functions authenticate and shape requests; PostgreSQL transactions
  enforce ownership, device leases, one-use passes/capabilities, legal state
  changes, idempotency, final submissions, and retention.
- Use fixed-search-path `SECURITY DEFINER` functions only when needed. Revoke
  default execution and grant only the exact role. Secret keys call narrow RPCs,
  never arbitrary writes.
- Database/Storage-heavy calls use Mumbai `ap-south-1`. Client wrappers must
  pass the region explicitly.
- Admins and field coordinators require authenticator-app MFA. Admin screens
  must never read protected answers or private report content.
- Production printed passes use twelve random Crockford Base32 characters,
  stored only as peppered HMACs. Plain passes and capabilities must never be
  logged or stored server-side.
- Participant work requires internet. Operator work may queue offline only with
  an unexpired device lease, assignment, challenge, and signed task work lease.
  Never display “Submitted” before server acceptance.
- Private reports store school, allowed category, text, school-local date, and
  retention date only. They have no exact application timestamp or joinable
  participant/session/pass/capability/device/operator record.
- Sensitive/immediate-safety content is rejected and never stored. Do not use
  speculative text classification.
- Primary and mirrored objects share one `delete_after`; backups never extend
  retention. A restored environment stays isolated until the restore gate
  deletes expired data and reapplies revocations.
- Do not place real child data in any environment until legal, privacy, consent,
  safety, deletion, and incident-response approval is recorded.
