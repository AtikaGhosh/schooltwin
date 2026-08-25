# SchoolTwin hackathon demo runbook

This runbook is for the fictional local demo only. Production mode has no demo
codes and never uploads these records. Pilot setup is documented separately in
[`backend-runbook.md`](backend-runbook.md).

## Action-first usability check

On the actual Android and Windows demonstration devices, verify the Odia font,
date/number formatting, 48px touch targets, camera permission, and the absence
of horizontal scrolling in the class matrix. Record the device/OS/browser and
the fluent Odia reviewer's corrections here before the public demo.

Run one unbriefed test using only: “Aaj Class 8A ka kaam karna hai. App use
karke karo.” The tester must reach **Class 8A → Record Class Video → Record
now** without being taught SchoolTwin terminology.

- Android device/browser: Not yet recorded
- Windows device/browser: Not yet recorded
- Fluent Odia review: Pending
- Unbriefed tester result: Pending

## Supported environment

- Latest Chrome or Chromium
- HTTPS deployment or `localhost`
- Camera permission enabled for Live Evidence
- Run the judge storyline during Sundarpur's configured 10:00 AM–4:00 PM school
  day. Automated browser tests fix the browser clock at 1:00 PM IST; capture
  timestamps in the application continue to use the actual local clock.

## Prototype participant credentials

These fictional, deterministic credentials are listed on the demo-only
`/demo-tools/codes` page so prototype testers can copy and open each workflow
quickly. Open **History → Demo tools → Demo check codes**. The page is absent in
production mode. Every section still has a unique, section-scoped, single-use
Class Pulse credential; codes for seeded completed checks are labelled Used.

| Workflow               | Prototype code | Intended demonstration                                       |
| ---------------------- | -------------- | ------------------------------------------------------------ |
| Class 7B School Pulse  | `C7B-H7D`      | Open daily section assignment.                               |
| Class 8A School Pulse  | `C8A-M9T`      | Primary judge workflow; submit once and reject reopening.    |
| Class 8B School Pulse  | `C8B-X2G`      | Open section with prior-day coverage gaps.                   |
| Class 9A School Pulse  | `C9A-L5W`      | Open daily section assignment.                               |
| Private Student Pulse  | `P7K-4M9`      | Submit one or two private personal-experience observations.  |
| Private Student Report | `R3T-8Q2`      | Submit an operational report excluded from operator history. |

IndexedDB stores SHA-256 hashes of these codes. They demonstrate workflow
separation, not production authentication, and remain inspectable by someone who
controls the browser.

## Daily seed

Demo Reset creates five operational school days in `Asia/Kolkata`, with today
always used as the demo day:

- 18 Class School Pulse assignments: 14 submitted and 4 available;
- 18 Live Class Evidence assignments: Classes 1A–6B submitted and all six
  remaining videos available throughout school hours;
- one submitted operator Facility Pulse;
- submitted Kitchen video and open Drinking Water video; and
- private Student Pulse status without answers or counts.

Class 8B’s earlier rows intentionally contain neutral missing observations. No
risk, warning, or escalation is inferred.

## Recommended judge storyline

1. Open `/home`. Show the 14/18 section coverage matrix and four independent collection channels.
2. Open Today’s Collection and select Class 8A School Pulse. Redeem `C8A-M9T`, complete the structured form, submit, and show the neutral hand-back screen.
3. Reload and show that the session is locked. Open Submissions and confirm that only completion/time appears—never answers, attendance estimate, or code.
4. Show that the completed Facility Pulse exposes only its operator-safe completion record.
5. Open Class 8A Live Attendance Evidence. Show the persisted prototype challenge, camera/marker flow, continuous recording, fingerprint, local submission, and playback after reload.
6. Open the private Student Pulse with `P7K-4M9`, submit, and show its locked state. The operator sees status only.
7. Submit an attributed report, then use `/report/private/session-private-report-demo` with `R3T-8Q2`. Show that private content, category, and timestamp are absent from operator history.
8. Select the sensitive/immediate-safety category and show that the draft is cleared before protected-channel guidance.
9. Open Class 8A in the Operational Twin. Show today’s Pulse/Evidence pair and five-day status matrix without answers, estimates, confidence, warnings, or conclusions.
10. Run Demo Reset and confirm that structured records and capture blobs are deleted and the corrected daily scenario returns.

`/reality-check/[sessionId]` exists only as a compatibility redirect to the
corresponding `/school-pulse/[sessionId]` route.

## Answering the authenticity question

This frontend milestone does not claim to prove physical authenticity. It
demonstrates live in-app recording, challenge-based collection, marker checks,
continuous capture, local timestamps, and evidence fingerprints. Production
deployment would move issuance, storage, authorization, and verification to
government-controlled backend infrastructure and combine these signals with
independent analysis.
