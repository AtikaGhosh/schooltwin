# Prompt 3 — Pre-Paired Workspace and Home

## Objective

Open directly into the pre-paired Sundarpur operational workspace and make daily section coverage the School Operator’s Home page.

## Existing behavior being replaced

The legacy dashboard foregrounds analytical school health, confidence, oversight roles, and intelligence cards.

## Expected changes

Build `/home` from repository projections and add the optional `/setup` pairing demonstration.

## Requirements

- Show fictional school identity and paired prototype status.
- Show the 18-section coverage total and Class Pulse matrix, Live Class Evidence
  total, Facility Pulse status, selected facility evidence, privacy-safe Student
  Pulse status, Twin preview, and permitted submissions.
- Explain that the app collects observations and does not decide what they prove.
- Make setup clearly non-authenticating and optional.

## Explicit non-goals

No onboarding interruption, government authentication, performance scores, confidence, Reality Gaps, rankings, warnings, or Officials App views.

## Privacy requirements

Home consumes repository projections. It never receives Pulse answers, participant references, credentials, or private-report details.

## UX requirements

Use a serious civic-tech visual language, responsive cards, semantic headings, visible focus, and text labels for every status.

## Acceptance criteria

The demo lands at Home, Sundarpur data comes from the deterministic seed, task status is derived from the clock, and only permitted submissions appear.

## Required automated tests

Test the 14/18 Class Pulse seed, 12/18 Live Evidence seed, coverage matrix,
facility/private status, permitted submissions, setup wording, and forbidden
intelligence absence.

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

Report Home/setup behavior, projection use, responsive/accessibility coverage, tests, validation results, and limitations.

# Action-first revision

Home derives `TodayWorkView`, shows the next action, up to four additional Do
now items, compact progress, and a protected Student Mode action. Do not render
the coverage matrix, architecture copy, history, or Twin grid on Home.
