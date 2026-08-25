# Prompt 4 — Tasks and Operational Twin

## Objective

Implement Today’s Collection as an 18-section Pulse/Evidence coverage matrix,
facility checks, derived time-window behavior, and navigable operational school
structure with five-day section history.

## Existing behavior being replaced

The prior Twin presents analytical school state and the legacy UI has no controlled task schedule.

## Expected changes

Build `/tasks`, `/tasks/[taskId]`, `/facility-pulse/[assignmentId]`, `/twin`, and
`/twin/[areaId]` from repository projections and centralized domain logic.

## Requirements

- Persist no `available` state; derive it from the injected clock.
- Derive one full-day routine window from the school's time zone, opening time,
  and closing time. Present Not open yet, Do now, Done, or Not done; do not add
  short routine slots or a Later today group.
- Display scheduled, available, in-progress, submitted, missed, and failed states.
- Explain the configured in-progress completion grace period.
- Show exactly 18 Class Pulses and 18 Live Class Evidence assignments, grouped
  facility checks, and private Student Pulse status without counts.
- Show buildings, 18 sections, facilities, expected strength, today’s
  Pulse/Evidence pair, five-day status, and permitted submissions.
- Link legal available workflows to their dedicated routes.

## Explicit non-goals

No analytical Twin, inferred health, confidence, gaps, ranking, comparison, investigation, capture implementation, or participant forms.

## Privacy requirements

Area submission history is operator-projected. Private student answers and private reports are absent.

## UX requirements

Support desktop and mobile layouts, semantic descriptions, non-color status labels, empty states, and keyboard focus.

## Acceptance criteria

Relative task states update correctly, expired scheduled tasks reconcile to missed, operational areas are navigable, and no analytical terminology appears in rendered routes.

## Required automated tests

Test configured school-hour boundaries, coverage totals/matrices, Class 8B
neutral gaps, area history, expected strength, privacy exclusion, and forbidden
UX absence.

## Validation commands

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

## Completion report

Report domain/UI behavior, route changes, tests, commands, outcomes, and genuine limitations.

# Action-first revision

Present routes as Today’s Work and Our School. Group work by Do now, Not open
yet when applicable, Not done, and collapsed Done; keep the matrix behind View all classes and use cards
without horizontal scrolling on mobile.
