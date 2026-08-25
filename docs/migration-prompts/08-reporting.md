# Prompt 8 — Operational Reporting

## Objective

Implement attributed School Operator reporting, private student reporting, and non-persisted sensitive guidance.

## Existing behavior being replaced

Operator and private-report routes are placeholders.

## Expected changes

Add validated forms, private-session grant redemption, protected projection behavior, sensitive-category routing, submissions, and audit events.

## Requirements

Operator reports are locally attributed. Private reports contain no participant reference after eligibility. Sensitive-category selection clears the draft before guidance and persists no content, evidence, identity, or description.

## Explicit non-goals

No AI diagnosis, fake notifications, unverified contacts, backend anonymity guarantee, or Officials App escalation.

## Privacy requirements

Private report content, category, timestamp, and participant metadata are entirely absent from operator history.

## UX requirements

Accessible categories and descriptions, clear attribution/privacy copy, code errors, success states, and protected-channel guidance.

## Acceptance criteria

Operator reports appear in permitted history; ordinary private reports do not; sensitive content is cleared and never stored.

## Required automated tests

Test validation, attribution, private unlinking/exclusion, code states, sensitive non-persistence, and no fake backend claims.

## Validation commands

Run the six standard pnpm validation commands.

## Completion report

Report both modes, sensitive policy, tests, results, and privacy limitations.

# Action-first revision

Use large touch category tiles, a plain description field, and one Send Report
action. Preserve sensitive-content clearing and private-report exclusion.
