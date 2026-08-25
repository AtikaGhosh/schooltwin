# SchoolTwin School Collection App architecture

> Backend update (25 August 2026): the fictional IndexedDB demo remains, and a
> separate pilot Supabase production path is now implemented. Server identity,
> work, time, acceptance, passes, private Storage, and retention are defined in
> [`backend-architecture-v1.md`](backend-architecture-v1.md). Nothing in that
> backend changes the School-versus-Officials product boundary below.

## Action-first bilingual presentation

The v5 model is presented as a daily work assistant. `TodayWorkView` derives
all counts and groups 18 Daily Class Checks, 18 Class Videos, one Daily Facility
Check, and two facility videos into Done, Do now, Not open yet, and Not done. Student
Private Check is an independent protected action and is excluded from totals.

Visible navigation is Home, Today’s Work, Our School, Report Problem, and
History. UI locale is stored in v4 metadata (`en` or `or`), mapped to
`en-IN`/`or-IN`, and preserved through Demo Reset. Guided workflows never
persist partial answers; a redeemed active session restarts at question one
after refresh without requesting the consumed code again.

## 1. Product boundary

This repository is the frontend-first SchoolTwin School Collection App. It
collects operational observations from a monitored school and shows operators
whether each section completed today’s required collection.

> Collection mechanisms collect observations, not conclusions.

The future Officials App—not this repository—will corroborate observations and
perform analysis, confidence scoring, Reality Gap detection, warnings,
investigation, verification, escalation, and government monitoring. The School
app never exposes that intelligence to the monitored school.

## 2. Four daily collection channels

1. **Class School Pulse:** one mandatory, protected structured observation for
   each of the 18 sections every operational day.
2. **Live Evidence:** one mandatory Live Class Evidence assignment for every
   section, plus selected facility capture tasks.
3. **Private Student Pulse:** random one-or-two-question personal-experience
   sampling, hidden from operators except for `inactive | active | completed`.
4. **Operational reports:** locally attributed operator reports or private
   student reports that are entirely excluded from operator history.

No channel is treated as truth. Missing submissions are described neutrally and
do not generate risk, warnings, or escalation.

## 3. Routes and layouts

Operator routes:

```text
/home
/setup
/tasks
/tasks/[taskId]
/capture/[taskId]
/facility-pulse/[assignmentId]
/report
/submissions
/twin
/twin/[areaId]
/privacy
```

Restricted kiosk routes:

```text
/school-pulse/[sessionId]
/pulse
/pulse/[sessionId]
/report/private/[sessionId]
```

`/reality-check/[sessionId]` is a compatibility redirect to the School Pulse
route. Kiosk pages render no operator navigation, submission history, other
sessions, or Twin access. `/` redirects to the pre-paired `/home` workspace.

## 4. Daily coverage domain

The primary records are `SchoolPulseDay`, `ClassPulseAssignment`,
`ClassPulseSession`, `ClassPulseResponse`, `FacilityPulseAssignment`,
`FacilityPulseResponse`, `StudentPulseSession`, `StudentPulseResponse`,
`VerificationTask`, `CaptureArtifact`, `Submission`, and `AuditEvent`.

Participant session types are:

```ts
type KioskSessionType = 'class_pulse' | 'student_pulse' | 'private_report'
```

`KioskSession` represents a restricted device workflow. `AccessGrant` is a
separate opaque, hashed, expiring, scoped, single-use credential.

Class Pulse captures approximate students present (bounded by expected section
strength), first-period teacher presence, scheduled classes held, electricity,
fans/lights, classroom usability, water, toilets, meal status, an unusual
condition category, and one seeded contextual answer. The operator-attributed
Facility Pulse covers water, boys’ and girls’ toilets, kitchen, electricity,
library, and playground in one daily form.

## 5. State and timing rules

Class/Facility Pulse assignments and Live Evidence use persisted states:

```text
scheduled | in_progress | submitted | missed | failed
```

`available` is derived from `Clock.now()` and the assignment window. Work not
started by the window end becomes missed. Work started legally inside a window
may finish until `scheduledEnd + TASK_COMPLETION_GRACE_MS`; unfinished work past
that boundary becomes failed. Transitions are centralized and tested.

Class and private sessions use `issued → active → completed` or `expired`.
Access Grants use `issued → redeemed` or `expired`.

Each `School` owns its `timeZone`, `openingTime`, and `closingTime`. Production
assignments use server-issued windows based on that configuration. The isolated
fictional hackathon demo deliberately uses the full current school-local
calendar day, allowing it to be presented before 10:00 AM or after 4:00 PM.
This demo convenience does not change production time enforcement. The School
app has no “Later today” queue.
Rare time-restricted surprise verification is deferred to the future Officials
App. Work started before closing retains the five-minute completion grace.

## 6. Seed and operational history

The seed preserves the 18-section Class 1A–9B roster and creates five
operational school days in `Asia/Kolkata`, skipping weekends where possible.
Today is always relative to the injected clock.

- Class Pulse: 14 submitted; 7B, 8A, 8B, and 9A remain open throughout the demo day.
- Live Class Evidence: 1A–6B submitted; all six remaining sections use the same
  full school-day window.
- The Facility Pulse and Kitchen video are submitted; Drinking Water video
  remains open throughout the demo day.
- Completed assignments always have matching protected response, operator-safe
  Submission, and AuditEvent records.

Earlier neutral gaps, especially Class 8B, demonstrate history without
analytical interpretation. The section Twin shows today’s Pulse/Evidence pair
and five-day submitted/missing/pending status only.

## 7. Privacy projections

Raw IndexedDB records never flow to product components. Repository projection
functions create operator-safe and kiosk-safe DTOs.

Operator views exclude Class Pulse answers, attendance estimates, contextual
answers, participant/code references, Access Grants, private Student Pulse
answers/counts, every private-report detail, and Officials conclusions. Class
Pulse history contains completion status and submission time only.

Sensitive or immediate-safety selection clears the draft and shows protected
reporting guidance without persisting content or inventing contact information.
These are modeled frontend privacy boundaries, not guaranteed anonymity against
someone controlling the browser.

## 8. IndexedDB v5 and migration

`SchoolTwinRepository` is the only product-facing persistence boundary. Schema
v4 adds explicit stores for Pulse days, Class Pulse assignments/responses,
Facility Pulse assignments/responses, and section coverage history. Structured
records remain separate from `capture_blobs`.

The v3→v4 migration is non-destructive: it preserves captures, submissions,
private Pulse data, and legacy Reality Check records. Legacy records are exposed
only as read-only “Legacy class observation” history; new writes use Class Pulse
stores. If no current `SchoolPulseDay` exists, initialization backfills the new
daily scenario without recreating the database. Demo Reset deliberately clears
every old/new structured and blob store and seeds only the corrected model.
Schema v5 adds school operating hours and non-destructively expands current-day
routine windows while preserving submitted work, captures, responses, and
private records.

## 9. Live Evidence and truthfulness

Supported environment is latest Chrome/Chromium over HTTPS or localhost with
camera permission. The flow validates the window, persists one locally issued
challenge, requests camera access, observes the expected marker, records one
continuous 10–60 second MediaRecorder session, supports review/retake, checks
quota, creates a SHA-256 fingerprint, and stores the blob, metadata, Submission,
and local AuditEvent. There is no gallery upload and no pause control.

The prototype may say “Recorded continuously in this SchoolTwin session” and
“Evidence fingerprint generated.” It must not claim server verification,
immutability, tamper resistance, physical authenticity, device attestation,
verified identity, presence proof, or guaranteed anonymity.

Captured evidence is expected to survive normal refresh/relaunch in the current
browser profile unless storage is manually cleared or evicted. Persistent
storage is requested where available and reported honestly.

## 10. Replaceable production boundary

Browser and persistence behavior remains behind `SchoolTwinRepository`,
`TaskIssuer`, `ChallengeGenerator`, `CaptureService`, `MarkerScanner`, `Clock`,
`IdGenerator`, `EntropySource`, `BlobHasher`, and `StorageQuotaService`.

Production may replace local storage, timestamps, challenges, credentials, and
audit events with Supabase/PostgreSQL, remote object storage, and server controls
without redesigning the collection flows. Deferred scope includes all Officials
App intelligence, AI analysis, Reality Engine, confidence, Reality Gaps,
rankings, warnings, investigations, escalation, biometrics, production auth,
device attestation, government integrations, and remote upload.
