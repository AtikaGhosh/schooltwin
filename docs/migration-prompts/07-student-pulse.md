# Prompt 7 — Private Student Pulse

## Objective

Implement random private, single-use Student Pulse sampling that remains wholly
independent of mandatory Class School Pulse.

## Existing behavior being replaced

The Pulse entry and session routes are placeholders.

## Expected changes

Add neutral session entry, grant redemption, Pulse questions, protected persistence, lock state, and privacy projections.

## Requirements

Use an opaque hashed code, enforce expiry and single use, collect only the assigned one-to-two questions, persist once, consume the code, thank the participant, and prevent reopen.

## Explicit non-goals

No long survey, participant identity confirmation, aggregation, analytics, or school-facing answers.

## Privacy requirements

Raw answers, counts, and code references never reach operator projections or
components. Operator status is only `inactive | active | completed`.

## UX requirements

Focused kiosk layout with clear code errors, accessible choices, submit validation, completion lock, and device hand-back copy.

## Acceptance criteria

The Pulse completes once and operator product surfaces cannot reveal answers or credentials.

## Required automated tests

Test invalid/expired/used codes, answers, persistence, lockout, reload, projection safety, and kiosk isolation.

## Validation commands

Run the six standard pnpm validation commands.

## Completion report

Report workflow, privacy evidence, tests, results, and frontend anonymity limitation.

# Action-first revision

Expose Student Private Check as an operator action, then remove the operator
shell completely. Present one question per screen and finish with a neutral
device hand-back screen.
