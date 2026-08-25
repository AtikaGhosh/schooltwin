# Prompt 9 — Submissions, Privacy, and Reset

## Objective

Complete operator-safe history, local playback, storage/privacy disclosure, and deterministic Demo Reset.

## Existing behavior being replaced

Submissions and Privacy routes are placeholders and reset is unavailable.

## Expected changes

Render projected records, retained capture playback/fingerprints, browser persistence state, compatibility/retention limitations, and confirmed reset.

## Requirements

Show Live Evidence, Class Pulse completion/time, Facility Pulse completion, and
operator reports only. Request `navigator.storage.persist()` where supported and
record its result. Reset every v1–v4 structured store and blob, restore the
five-day 18-by-18 Sundarpur scenario, and return Home.

## Explicit non-goals

No remote backup, permanent retention promise, raw participant history, or analytical records.

## Privacy requirements

Class/Student Pulse answers, attendance estimates, credentials, and every
private-report detail remain absent.

## UX requirements

Accessible playback, empty/error/loading states, readable browser guidance, and an explicit destructive confirmation dialog.

## Acceptance criteria

Playback survives refresh where storage remains; privacy copy is truthful; reset
removes all local evidence and restores the corrected daily coverage seed.

## Required automated tests

Test projections, playback, persistence-permission states, eviction copy, blob cleanup, confirmation, restored seed, and private-content absence.

## Validation commands

Run the six standard pnpm validation commands.

## Completion report

Report records/storage/reset behavior, tests, results, and browser limitations.

# Action-first revision

Present operator-safe records as History grouped by Asia/Kolkata day. Keep
video/fingerprint details expandable and Demo Reset inside Demo tools. Preserve
the selected locale during reset.
