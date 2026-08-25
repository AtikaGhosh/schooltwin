# Prompt 0 — Toolchain and regression baseline

## Objective

Normalize the repository on pnpm 11.19.0 and establish strict formatting,
linting, type checking, unit/component testing, Playwright smoke testing, and
production build validation without changing the existing product UX.

## Existing behavior being preserved

The original role-switching v0 prototype must still render and navigate during
this phase. Product migration begins only after the baseline is green.

## Requirements

- Keep pnpm as the sole package manager and remove the npm lockfile.
- Move pnpm overrides and build-script policy to `pnpm-workspace.yaml`.
- Pin `packageManager` to pnpm 11.19.0.
- Remove Next.js build-time TypeScript bypasses.
- Configure Prettier, ESLint, Vitest, React Testing Library, and Playwright.
- Add baseline unit/component and Chromium smoke tests for the current UI.
- Preserve the existing local commit and unrelated working-tree changes.

## Non-goals

- Do not change role navigation, routes, data models, or visible product copy.
- Do not add the new School Collection App features yet.

## Acceptance criteria

The current application remains usable and all validation commands pass.

## Validation

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

## Completion report

Report package-manager changes, configurations and tests added, every command
executed, exact results, and any genuine environment limitation.
