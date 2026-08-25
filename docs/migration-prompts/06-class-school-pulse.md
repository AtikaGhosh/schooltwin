# Prompt 6 — Mandatory Class School Pulse

## Objective

Implement an isolated, code-gated daily Class School Pulse for every section.

## Existing behavior being replaced

The daily coverage matrix has assignments but no protected section workflow.

## Expected changes

Add `/school-pulse/[sessionId]`, section-specific grant redemption, the structured
Class Pulse form, protected persistence, completion lock, audit event,
operator-safe completion, and neutral hand-back state. Keep legacy
`/reality-check/[sessionId]` as a redirect only.

## Requirements

Use `class_pulse` sessions and separate hashed Access Grants. Validate attendance
against expected strength, required enums, and one contextual question. Submit
once, consume the credential, lock the session, and reject expiry/reuse.

## Explicit non-goals

No analytics, estimated attendance in operator views, verified-reality claim,
identity inference, or Officials App conclusions. Legacy class observations are
read-only.

## Privacy requirements

Operator history receives completion metadata, never the credential or raw question-answer records.

## UX requirements

Hide all operator navigation; provide invalid, expired, used, active, validation, submitted, and neutral completion states.

## Acceptance criteria

A valid section code completes once, persists a protected Class Pulse response,
and cannot reopen the session.

## Required automated tests

Test 18 unique code scopes, numeric/enum/contextual validation, completion, reuse
prevention, projection safety, compatibility redirect, kiosk isolation, and
operator-safe history.

## Validation commands

Run the six standard pnpm validation commands.

## Completion report

Report session/grant behavior, privacy boundary, tests, commands, results, and limitations.

# Action-first revision

Use the touch-first `GuidedWizard` with one question per screen, large answer
buttons, progress, Back/Next, focus management, and active redeemed-session
recovery without persisting partial answers.
