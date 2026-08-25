# Prompt 2 — Routes and Application Shell

## Objective

Replace the role-switching single-page prototype with real Next.js routes, an operator shell, and an isolated kiosk shell.

## Existing behavior being replaced

The legacy interface swaps School, Inspector, and Authority views inside one client component.

## Expected changes

Add the frozen route tree, desktop sidebar, mobile bottom navigation, restricted kiosk layout, and root redirect. Remove legacy oversight surfaces and navigation.

## Requirements

- Implement `/home`, `/setup`, `/tasks`, `/tasks/[taskId]`, `/capture/[taskId]`, `/pulse`, `/pulse/[sessionId]`, `/reality-check/[sessionId]`, `/report`, `/report/private/[sessionId]`, `/submissions`, `/twin`, `/twin/[areaId]`, and `/privacy`.
- Use the operator shell for school-operation routes and the stripped kiosk shell for participant routes.
- Route refresh must work.

## Explicit non-goals

Do not implement capture, participant forms, reporting persistence, Officials App screens, analysis, scoring, warnings, or investigations.

## Privacy requirements

Kiosk routes expose no operator navigation, history, Twin access, other sessions, or participant credentials.

## UX requirements

Provide accessible active states, keyboard focus, desktop navigation, mobile navigation, and meaningful route placeholders for later prompts.

## Acceptance criteria

The old role switcher is gone, `/` redirects to `/home`, every frozen route resolves, and rendered school surfaces contain no Officials App intelligence.

## Required automated tests

Test root redirect, route refresh, desktop/mobile navigation, kiosk isolation, and absence of forbidden product-surface terminology.

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

Report routes and layouts added, legacy surfaces removed, tests created, commands executed, results, and genuine limitations.
