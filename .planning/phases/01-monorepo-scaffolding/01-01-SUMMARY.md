---
phase: 01-monorepo-scaffolding
plan: 01
subsystem: infra
tags: [npm-workspaces, typescript, vite, concurrently, monorepo, react, tsx]

# Dependency graph
requires:
  - phase: none
    provides: "First plan — no prior dependencies"
provides:
  - "npm workspaces resolving @nova-imperia/shared in client and server"
  - "TypeScript strict-mode build across all three packages (tsc --build)"
  - "Vite dev server for client on port 5173 with React plugin"
  - "Concurrent dev command with CLIENT/SERVER/SHARED prefixes"
  - "Package boundary enforcement (shared cannot import client/server)"
  - ".nvmrc pinning Node 20"
affects: [01-monorepo-scaffolding, 02-shared-types, 03-phaser-bootstrap, 04-react-integration, 05-server-bootstrap]

# Tech tracking
tech-stack:
  added: [typescript@5.9.3, concurrently@9.2.1, react@19.2.4, react-dom@19.2.4, vite@8.0.1, "@vitejs/plugin-react@6.0.1", "@types/react@19.2.14", "@types/react-dom@19.2.3", tsx@4.21.0]
  patterns: [solution-style-tsconfig, npm-workspaces, typescript-project-references, concurrent-dev-scripts]

key-files:
  created: [.nvmrc, packages/client/vite.config.ts, packages/client/index.html, packages/shared/src/boundary-test.ts, package-lock.json]
  modified: [package.json, tsconfig.json, packages/client/package.json, packages/client/src/main.ts, packages/server/package.json, packages/server/src/main.ts, packages/shared/package.json]

key-decisions:
  - "Used Galaxy type (Pick<Galaxy, 'seed'>) instead of nonexistent GalaxyConfig for shared import proof"
  - "Added files:[]/include:[] to root tsconfig for solution-style project (prevents stray build output from vite.config.ts)"

patterns-established:
  - "Solution-style root tsconfig: files:[], include:[], only references — prevents root from compiling stray files"
  - "Concurrent dev command: concurrently with --kill-others-on-fail and named prefixes for all three packages"
  - "Package boundary enforcement via TypeScript project references (shared has no references to client/server)"

requirements-completed: [MONO-01, MONO-02, MONO-05, MONO-06]

# Metrics
duration: 4min
completed: 2026-03-21
---

# Phase 01 Plan 01: Monorepo Scaffolding — Dependencies & Build Tooling Summary

**npm workspaces with TypeScript 5.9 strict build, Vite 8 + React 19 client, tsx server, and concurrent dev command with package boundary enforcement**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-21T18:06:43Z
- **Completed:** 2026-03-21T18:11:32Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- All npm dependencies installed across root, client, server, and shared packages with zero errors
- TypeScript compiles all three packages in strict mode with zero errors via `npx tsc --build`
- Vite dev server configured for client with React plugin, auto-open, port 5173
- Concurrent dev command starts all three packages with colored `[CLIENT]`, `[SERVER]`, `[SHARED]` prefixes
- Package boundary enforcement proven: shared importing from client produces TS2307 compile error
- Both client and server successfully import types from `@nova-imperia/shared`

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies and configure build tooling** - `58e7aef` (feat)
2. **Task 2: Verify package boundaries and dev command** - `5f92b9c` (test)

**Plan metadata:** (pending final docs commit)

## Files Created/Modified
- `package.json` - Root workspace config with dev/build/typecheck scripts, concurrently and TypeScript devDependencies
- `package-lock.json` - Lockfile for all workspace dependencies
- `tsconfig.json` - Added files:[]/include:[] for solution-style project references
- `.nvmrc` - Node version pin (20)
- `packages/client/package.json` - Added React, Vite, and type dependencies
- `packages/client/vite.config.ts` - Vite config with React plugin, port 5173, auto-open
- `packages/client/index.html` - Vite HTML entry point with root div and module script
- `packages/client/src/main.ts` - Client entry point importing Galaxy type from shared
- `packages/server/package.json` - Added tsx devDependency
- `packages/server/src/main.ts` - Server entry point importing Galaxy type from shared
- `packages/shared/package.json` - Added dev script (tsc --watch --preserveWatchOutput)
- `packages/shared/src/boundary-test.ts` - MONO-06 boundary enforcement documentation

## Decisions Made
- **Used Galaxy type instead of GalaxyConfig:** Plan specified `GalaxyConfig` but it doesn't exist in shared types. Used `Pick<Galaxy, 'seed'> & { name: string }` to prove cross-package imports work with a real exported type.
- **Added files:[]/include:[] to root tsconfig:** Root tsconfig with `composite: true` was compiling `vite.config.ts` and producing stray `.js`/`.d.ts` files in the client package root. Fixed by making it a pure solution-style tsconfig that only references sub-projects.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed root tsconfig generating stray build output**
- **Found during:** Task 1 (Install dependencies and configure build tooling)
- **Issue:** Root tsconfig with `composite: true` and no `files`/`include` was compiling `packages/client/vite.config.ts`, producing `vite.config.js`, `vite.config.d.ts`, and map files in the client package root directory
- **Fix:** Added `"files": []` and `"include": []` to root tsconfig.json to make it a pure solution-style project that only delegates to referenced sub-projects
- **Files modified:** tsconfig.json
- **Verification:** `npx tsc --build` produces no files outside `dist/` directories
- **Committed in:** 58e7aef (Task 1 commit)

**2. [Rule 1 - Bug] Fixed @ts-expect-error on commented-out imports in boundary-test.ts**
- **Found during:** Task 2 (Verify package boundaries and dev command)
- **Issue:** Plan specified `@ts-expect-error` directives above commented-out import lines, but since the imports are comments (not code), TypeScript reports "Unused @ts-expect-error directive" errors
- **Fix:** Removed `@ts-expect-error` directives, kept imports as plain comments with descriptive text
- **Files modified:** packages/shared/src/boundary-test.ts
- **Verification:** `npx tsc --build` exits 0 with the boundary-test.ts file present
- **Committed in:** 5f92b9c (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All build tooling in place for Plan 02 (ESLint + Prettier configuration)
- TypeScript compiles cleanly — linting/formatting can be layered on top
- Dev command works — all three packages start concurrently
- Package boundaries enforced — ready for shared types expansion in Phase 2

## Self-Check: PASSED

All 12 created/modified files verified present. Both task commits (58e7aef, 5f92b9c) verified in git log.

---
*Phase: 01-monorepo-scaffolding*
*Completed: 2026-03-21*
