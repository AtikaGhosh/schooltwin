# Prompt 1 — Domain and versioned persistence

## Objective

Introduce the School Collection App domain, deterministic relative Sundarpur
seed, explicit privacy projections, browser adapter contracts, and a versioned
IndexedDB repository without migrating the visible product yet.

## Existing behavior being preserved

The original role-switching UI continues to run against its old fixture data
until Prompt 2 replaces it.

## Requirements

- Model School Pulse days, 18 daily Class Pulse assignments and protected
  responses, one Facility Pulse, private Student Pulse, Live Evidence tasks,
  kiosk sessions, Access Grants, reports, captures, submissions, and audit
  events.
- Persist only legal task states and derive `available` from `Clock.now()`.
- Enforce the configurable completion grace period.
- Implement `SchoolTwinDb` schema upgrades v1 through v4 centrally. The v4
  upgrade preserves v3 captures, submissions, private Pulse data, and read-only
  legacy class observations; it must never recreate the database.
- Keep blobs in a separate store.
- Seed five operational days, 18-by-18 daily section coverage, matching protected
  responses/submissions/events, school-hours evidence windows, and neutral gaps.
- Store only hashes of documented prototype codes.
- Implement repository-owned Access Grant redemption and Demo Reset.
- Project raw records into operator-safe and kiosk-safe DTOs.
- Put all browser/domain dependencies behind replaceable interfaces.

## Non-goals

- Do not change routes or visible product screens.
- Do not add Supabase, production authentication, or server claims.

## Privacy requirements

Operator projections omit Class/Student Pulse answers, attendance estimates,
participant references, Access Grants, and private-report content. Class Pulse
exposes completion/time only. Sensitive report content is never persisted.

## Acceptance criteria and tests

Test v3→v4 preservation, exact 18-by-18 coverage, five-day history, reset,
legal/illegal transitions, configured school-hours windows, contextual questions, response
validation, grant hashing/expiry/reuse, projections, and blob cleanup.

## Validation

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

## Completion report

Report domain interfaces, schema versions, privacy boundaries, tests, commands,
results, and genuine prototype limitations.
