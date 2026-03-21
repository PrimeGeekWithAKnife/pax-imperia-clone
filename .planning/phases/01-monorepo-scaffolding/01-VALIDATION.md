---
phase: 1
slug: monorepo-scaffolding
status: draft
nyquist_compliant: false
wave_0_complete: false
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

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | MONO-01 | smoke | `npm install && ls node_modules/@nova-imperia` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | MONO-02 | smoke | `npx tsc --build` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | MONO-03 | smoke | `npm run lint` | ❌ W0 | ⬜ pending |
| 01-02-02 | 02 | 1 | MONO-04 | smoke | `npx prettier --check "packages/*/src/**/*.{ts,tsx}"` | ❌ W0 | ⬜ pending |
| 01-01-03 | 01 | 1 | MONO-05 | manual | `npm run dev` (observe concurrent output) | ❌ W0 | ⬜ pending |
| 01-01-04 | 01 | 1 | MONO-06 | smoke | `npx tsc --build` (boundary violation file causes error) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `concurrently` — installed for concurrent dev scripts
- [ ] `eslint.config.mjs` — ESLint flat config with typescript-eslint
- [ ] `.prettierrc` — Prettier configuration
- [ ] `vite.config.ts` — Vite client configuration

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dev server starts with hot reload | MONO-05 | Requires running server and observing output | Run `npm run dev`, verify colored prefixed output from client + server + shared |
| Browser auto-opens on dev start | CONTEXT | Requires visual verification | Run `npm run dev`, confirm browser opens to localhost:5173 |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
