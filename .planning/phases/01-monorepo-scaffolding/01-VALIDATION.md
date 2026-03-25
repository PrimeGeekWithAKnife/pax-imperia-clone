---
phase: 1
slug: monorepo-scaffolding
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-21
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x (installed by Phase 1) |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `npx tsc --build --noEmit` |
| **Full suite command** | `npm run typecheck && npm run lint && npx prettier --check "packages/*/src/**/*.{ts,tsx}"` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --build --noEmit`
- **After every plan wave:** Run `npm run typecheck && npm run lint && npx prettier --check "packages/*/src/**/*.{ts,tsx}"`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 01-01-T1 | 01 | 1 | MONO-01, MONO-02 | smoke | `npm ls @nova-imperia/shared && npx tsc --build` | ⬜ pending |
| 01-01-T2 | 01 | 1 | MONO-05, MONO-06 | smoke | `npx tsc --build` (boundary) + `timeout 8 npm run dev 2>&1 \| grep -E '\[(CLIENT\|SERVER\|SHARED)\]'` (dev cmd) | ⬜ pending |
| 01-02-T1 | 02 | 2 | MONO-03 | smoke | `node -e "import('./eslint.config.mjs')"` (config loads) | ⬜ pending |
| 01-02-T2 | 02 | 2 | MONO-03, MONO-04 | smoke | `npm run lint && npx prettier --check "packages/*/src/**/*.{ts,tsx}"` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `concurrently` — installed for concurrent dev scripts (Plan 01-01, Task 1)
- [x] `eslint.config.mjs` — ESLint flat config with typescript-eslint (Plan 01-02, Task 1)
- [x] `.prettierrc` — Prettier configuration (Plan 01-02, Task 1)
- [x] `vite.config.ts` — Vite client configuration (Plan 01-01, Task 1)

*All Wave 0 tooling is created by the plan tasks themselves — no pre-existing infrastructure gaps.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Browser auto-opens on dev start | CONTEXT | Requires visual verification | Run `npm run dev`, confirm browser opens to localhost:5173 |

*Note: MONO-05 (dev server starts with concurrent output) now has automated verification via `timeout 8 npm run dev 2>&1 | grep` in Plan 01-01 Task 2.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved
