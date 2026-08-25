# Prompt 5 — Live Evidence

## Objective

Implement controlled, camera-originated Live Evidence end to end.

## Existing behavior being replaced

`/capture/[taskId]` is a routed placeholder without media collection.

## Expected changes

Add capture, marker, hash, quota, and challenge adapters; the capture state machine; blob persistence; permitted submission creation; and playback after refresh.

## Requirements

Validate the task window and completion grace period; issue one persisted prototype challenge; detect HTTPS/localhost, camera, MediaRecorder, and codecs; scan with BarcodeDetector then ZXing; offer an explicitly labelled demo confirmation only when configured; record continuously for 10–60 seconds with no pause or file upload; review, retake, hash, quota-check, persist, and submit. Remove superseded blobs immediately.

Routine capture uses the school's full operating-hours window. Short surprise
verification windows are future Officials App scope.

## Explicit non-goals

No gallery upload, remote storage, server time, device attestation, physical-presence proof, or authenticity conclusion.

## Privacy requirements

Capture metadata contains operational references only. Integrity copy must state local prototype facts, not security conclusions.

## UX requirements

Provide permission, unsupported-browser, insecure-context, busy-camera, duration, marker, quota, recording, review, failure, and success states. Recording state must use text as well as color.

## Acceptance criteria

An available task can record, review, retake, fingerprint, persist, submit, refresh, and replay while producing a matching Submission and AuditEvent.

## Required automated tests

Test codec detection, permission/capability failures, min/max duration, no pause, marker paths, quota limits, challenge persistence, retake cleanup, hashing, task completion, refresh playback, and reset cleanup.

## Validation commands

`pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, relevant `pnpm test:e2e`, and `pnpm build`.

## Completion report

Report adapters, capture states, persistence behavior, tests, validation results, and browser/prototype limitations.

# Action-first revision

Guide users through Start Camera, marker, positioning, continuous recording,
review/retake/submit, and a simple completion. Put fingerprints and integrity
wording in expandable technical details.
