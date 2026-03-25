# Phase 1: Monorepo Scaffolding - Research

**Researched:** 2026-03-21
**Domain:** npm workspaces + TypeScript project references + ESLint/Prettier + Vite + dev tooling
**Confidence:** HIGH

## Summary

Phase 1 scaffolds a TypeScript monorepo with three npm workspace packages (`@nova-imperia/client`, `@nova-imperia/server`, `@nova-imperia/shared`). The repo already has skeleton `package.json` files, a root `tsconfig.json` with project references, and placeholder source files. The work is to install actual dependencies, configure build/lint/format tooling, wire up the dev command with `concurrently`, and enforce package boundaries via TypeScript project references.

The primary technical risk flagged in STATE.md -- triple import resolution mismatch (npm workspaces + TypeScript + Vite) -- is addressed by using TypeScript's `moduleResolution: "bundler"` (already set in root tsconfig) combined with the shared package pointing `main`/`types` at source TypeScript files. Since the shared package is private and only consumed within the workspace, it does not need a build step for development. Vite resolves workspace packages through npm's symlinks, and TypeScript resolves them via project references and the `main`/`types` fields.

**Primary recommendation:** Use Vite 8.0.1 (stable since 2026-03-12, unified Rolldown bundler), ESLint 9.39.4 (full flat config, universal plugin compatibility), TypeScript 5.9.3 (latest), and a single root `eslint.config.mjs` that covers all packages.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- `npm run dev` starts all three packages (client, server, shared watcher) using `concurrently` with colored prefixes
- Client (Vite) on port 5173 (default), server on port 3000
- Vite auto-opens browser on dev start
- Shared package runs in watch mode so type changes trigger hot-reload in consumers

### Claude's Discretion
- ESLint flat config rules and strictness level
- Prettier configuration
- Exact dependency versions (Vite, React, Phaser, Fastify, etc.)
- Dependency pinning strategy (exact vs ranges)
- Package boundary enforcement approach
- Node version enforcement (`.nvmrc`, engines field, etc.)
- Dev script implementation details (concurrently flags, kill signals, etc.)
- tsconfig settings beyond what's already in the root config
- All other technical implementation choices

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MONO-01 | npm workspaces resolve correctly across client, server, and shared packages | npm workspaces already declared in root package.json; workspace `"*"` dependency resolution documented; `npm install` at root hoists deps |
| MONO-02 | TypeScript compiles cleanly with strict mode across all three packages | Root tsconfig has `strict: true`, `composite: true`, project references to all three packages; `npx tsc --build` uses incremental composite builds |
| MONO-03 | ESLint flat config with typescript-eslint runs across all packages | Single root `eslint.config.mjs` with `typescript-eslint` v8 `projectService` for automatic tsconfig resolution; ESLint 9 flat config |
| MONO-04 | Prettier configured and formatting consistently | Root `.prettierrc` + root-level `prettier --check` script; `eslint-config-prettier` disables conflicting ESLint rules |
| MONO-05 | Single `npm run dev` command starts client and server concurrently | `concurrently` with `--names` and `--prefix-colors` flags; client runs `vite --open`, server runs `tsx watch`, shared runs `tsc --watch` |
| MONO-06 | TypeScript project references enforce package boundaries (shared cannot import client/server) | Shared tsconfig has no `references` to client or server; attempting to import from them produces a compile error since TypeScript cannot resolve those modules |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| typescript | 5.9.3 | Language / type system | Latest stable; supports `moduleResolution: "bundler"`, `composite`, `customConditions` |
| vite | 8.0.1 | Client build tool / dev server | Stable release (2026-03-12); unified Rolldown bundler; faster builds; `@vitejs/plugin-react` v6 targets it |
| eslint | 9.39.4 | Linting | Latest v9; full flat config support; all plugins compatible (ESLint 10 released Feb 2026 but plugin ecosystem not fully caught up) |
| prettier | 3.8.1 | Code formatting | Latest stable |
| react | 19.2.4 | UI framework (for later phases) | Latest stable; installed now so tsconfig JSX is validated |
| react-dom | 19.2.4 | React DOM renderer | Paired with React |
| concurrently | 9.2.1 | Parallel dev commands | Standard for monorepo dev scripts |
| tsx | 4.21.0 | TypeScript Node.js runner | Used by server `dev` script for watch mode |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @vitejs/plugin-react | 6.0.1 | Vite React integration | Client package vite.config.ts |
| @eslint/js | 9.39.4 | ESLint recommended rules | Base config in eslint.config.mjs |
| typescript-eslint | 8.57.1 | TypeScript ESLint integration | Typed linting with projectService |
| eslint-config-prettier | 10.1.8 | Disable ESLint rules that conflict with Prettier | Last in ESLint config chain |
| eslint-plugin-react-hooks | 7.0.1 | React hooks linting rules | Flat config: `reactHooks.configs.flat.recommended` |
| eslint-plugin-react-refresh | 0.5.2 | Warn on non-HMR-safe exports | Client-specific ESLint rules |
| globals | 17.4.0 | Global variable definitions for ESLint | Browser/node globals in flat config |
| @types/react | 19.2.14 | React type definitions | Client package devDependency |
| @types/react-dom | 19.2.3 | ReactDOM type definitions | Client package devDependency |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ESLint 9 | ESLint 10 (10.1.0) | ESLint 10 has file-based config lookup (better for monorepos) but `eslint-plugin-react-hooks` lacks `^10` in peerDeps -- pending PR. Use ESLint 9 for stability; upgrade later. |
| Vite 8 | Vite 7.3.1 (earlier research choice) | Vite 7 is safe but Vite 8 is now stable with 10-30x faster builds via Rolldown. For a new project, Vite 8 is the right choice. Plugin ecosystem supports it. |
| Single root eslint.config.mjs | Per-package eslint configs | Per-package configs add maintenance overhead. A single root config with file-glob patterns is simpler and recommended by typescript-eslint docs. |

**Why ESLint 9 over 10:** ESLint 10.0.0 was released 2026-02-07 (6 weeks ago). Its key change for monorepos is file-based config lookup (starts from linted file, walks up). However, `eslint-plugin-react-hooks` v7.0.1 peerDeps only list through `^9.0.0` -- the PR to add `^10.0.0` is pending. Using ESLint 9 avoids peer dependency warnings and ensures all plugins are fully compatible. The flat config API is identical between ESLint 9 and 10.

**Why Vite 8 over 7:** The earlier research chose Vite 7.3 because Vite 8 was in beta. Vite 8.0.0 was released stable on 2026-03-12. It replaces esbuild+Rollup with a unified Rolldown bundler (10-30x faster production builds). For a brand-new project with no migration burden, Vite 8 is the better starting point. `@vitejs/plugin-react` v6.0.1 targets Vite 8, and Vitest 4.1.0 supports it.

**Installation:**

Root devDependencies:
```bash
npm install -D typescript@5.9.3 eslint@9.39.4 @eslint/js@9.39.4 typescript-eslint@8.57.1 eslint-config-prettier@10.1.8 eslint-plugin-react-hooks@7.0.1 eslint-plugin-react-refresh@0.5.2 globals@17.4.0 prettier@3.8.1 concurrently@9.2.1
```

Client package:
```bash
npm install -w packages/client react@19.2.4 react-dom@19.2.4
npm install -D -w packages/client vite@8.0.1 @vitejs/plugin-react@6.0.1 @types/react@19.2.14 @types/react-dom@19.2.3
```

Server package:
```bash
npm install -D -w packages/server tsx@4.21.0
```

## Architecture Patterns

### Recommended Project Structure (Phase 1 scope)
```
pax-imperia-clone/
├── packages/
│   ├── client/
│   │   ├── src/
│   │   │   └── main.ts              # Entry point (placeholder)
│   │   ├── index.html                # Vite HTML entry
│   │   ├── vite.config.ts            # Vite config with React plugin
│   │   ├── package.json              # @nova-imperia/client
│   │   └── tsconfig.json             # Extends root, references shared
│   ├── server/
│   │   ├── src/
│   │   │   └── main.ts              # Entry point (placeholder)
│   │   ├── package.json              # @nova-imperia/server
│   │   └── tsconfig.json             # Extends root, references shared
│   └── shared/
│       ├── src/
│       │   ├── index.ts              # Barrel re-export
│       │   └── types/
│       │       ├── index.ts          # Type barrel
│       │       ├── galaxy.ts         # (existing)
│       │       ├── species.ts        # (existing)
│       │       └── ships.ts          # (existing)
│       ├── package.json              # @nova-imperia/shared
│       └── tsconfig.json             # Extends root, NO references
├── eslint.config.mjs                 # Single flat config for all packages
├── .prettierrc                       # Prettier config
├── .prettierignore                   # Exclude dist, node_modules, etc.
├── .nvmrc                            # Pin Node version (20)
├── package.json                      # Root with workspaces + scripts
└── tsconfig.json                     # Root with project references
```

### Pattern 1: Single Root ESLint Flat Config with typescript-eslint projectService

**What:** One `eslint.config.mjs` at the repo root lints all packages using glob patterns. The `projectService` option automatically finds the nearest `tsconfig.json` for each file.
**When to use:** Always for this monorepo -- simpler than per-package configs.
**Example:**
```javascript
// eslint.config.mjs
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

export default tseslint.config(
  // Global ignores
  { ignores: ['**/dist/', '**/node_modules/', '**/*.tsbuildinfo'] },

  // Base recommended rules
  eslint.configs.recommended,

  // TypeScript rules with type checking
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // Client-specific: React rules
  {
    files: ['packages/client/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },

  // Server-specific: Node globals
  {
    files: ['packages/server/**/*.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },

  // Prettier must be last to override formatting rules
  eslintConfigPrettier,
);
```

### Pattern 2: npm Workspace Shared Package Resolution (No Build Step)

**What:** The shared package's `package.json` points `main` and `types` directly at source TypeScript files (`./src/index.ts`). Since the package is private and only consumed within the monorepo, Vite and TypeScript both resolve to source files without needing a build.
**When to use:** For the `@nova-imperia/shared` package in development.
**Existing setup:** Already configured in `packages/shared/package.json`:
```json
{
  "name": "@nova-imperia/shared",
  "main": "./src/index.ts",
  "types": "./src/index.ts"
}
```
**Why this works:** With `moduleResolution: "bundler"`, TypeScript follows the `types` field. Vite follows `main` via npm workspace symlinks. The `tsc --build` composite build compiles shared first (it has no references), then client and server (which reference shared).

### Pattern 3: TypeScript Project References for Build Ordering and Boundary Enforcement

**What:** Each package's `tsconfig.json` lists its dependencies in `references`. The root `tsconfig.json` lists all packages. Running `npx tsc --build` compiles them in dependency order with incremental caching.
**Boundary enforcement:** The shared package's tsconfig has NO `references` array -- it cannot import from client or server because TypeScript cannot resolve those modules. Any attempt to `import { ... } from '@nova-imperia/client'` in shared code will produce a TypeScript error.
**Existing setup:** Already correctly configured:
- Root: references `[shared, client, server]`
- Client: references `[shared]`
- Server: references `[shared]`
- Shared: no references

### Pattern 4: Concurrently Dev Command with Named Prefixes

**What:** Root `npm run dev` uses `concurrently` to start client, server, and shared watcher simultaneously with colored output prefixes.
**Example:**
```json
{
  "scripts": {
    "dev": "concurrently --kill-others-on-fail --names CLIENT,SERVER,SHARED --prefix-colors blue,green,yellow \"npm run dev -w packages/client\" \"npm run dev -w packages/server\" \"npm run dev -w packages/shared\""
  }
}
```
**Shared watcher:** The shared package needs a `dev` script that runs `tsc --watch --preserveWatchOutput` so that type changes are picked up by Vite's HMR in the client and tsx's watcher in the server.

### Anti-Patterns to Avoid
- **Per-package ESLint configs in a small monorepo:** Adds maintenance burden. One root config with glob patterns is cleaner.
- **Building shared package before dev:** Unnecessary when `main`/`types` point to source. Only needed for production builds.
- **Using `npm run dev --workspaces --if-present` for dev:** This runs workspaces sequentially, not concurrently, and doesn't support kill-on-fail. Use `concurrently` instead.
- **Using `"type": "module"` in shared package.json:** The shared package currently omits this, which is correct. Adding it could cause issues with `main: "./src/index.ts"` resolution in some tools. The client and server already have `"type": "module"`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| TypeScript lint rules | Custom ESLint rules | `typescript-eslint` strictTypeChecked config | 100+ rules maintained by experts; covers type-aware linting |
| Formatting enforcement | ESLint formatting rules | Prettier + eslint-config-prettier | Prettier is opinionated and fast; eslint-config-prettier disables conflicts |
| Concurrent process management | Shell `&` or custom scripts | `concurrently` package | Handles process cleanup, colored output, kill-on-fail |
| TypeScript execution in Node | Custom build+run pipeline | `tsx` | Handles ESM, TypeScript, watch mode out of the box |
| Module resolution across packages | Path aliases or custom resolvers | npm workspaces + `main`/`types` fields | Native Node.js resolution with workspace symlinks |

**Key insight:** The entire Phase 1 is about wiring together existing tools correctly. Every component (TypeScript, ESLint, Prettier, Vite, concurrently) is a mature, well-documented tool. The challenge is configuration compatibility, not custom code.

## Common Pitfalls

### Pitfall 1: TypeScript Project References Build Order
**What goes wrong:** Running `tsc` (not `tsc --build`) in a package with project references doesn't build dependencies first, leading to missing type errors.
**Why it happens:** `tsc` without `--build` only compiles the current project. `tsc --build` follows `references` and builds in dependency order.
**How to avoid:** Always use `npx tsc --build` at the root. Per-package `typecheck` scripts should use `tsc --noEmit` (which works because `main`/`types` point to source).
**Warning signs:** "Cannot find module '@nova-imperia/shared'" errors that appear intermittently.

### Pitfall 2: ESLint projectService with Files Outside tsconfig Include
**What goes wrong:** ESLint reports "file not included in any tsconfig" for config files like `eslint.config.mjs`, `vite.config.ts`, etc.
**Why it happens:** `projectService` tries to find a tsconfig that includes each linted file. Config files at the root aren't in any package's `include`.
**How to avoid:** Either: (a) add a `tsconfig.node.json` at root for config files, or (b) use `projectService: { allowDefaultProject: ['*.mjs', '*.ts'] }` to lint them with default settings, or (c) add them to ESLint's `ignores`.
**Warning signs:** ESLint errors on config files mentioning "not included in any tsconfig".

### Pitfall 3: Shared Package Watch Mode Not Triggering HMR
**What goes wrong:** Changing a type in the shared package doesn't trigger hot-reload in the client.
**Why it happens:** Vite watches the filesystem but may not detect changes in symlinked workspace packages unless the shared package emits updated `.d.ts` files or the Vite server detects the source file change.
**How to avoid:** Run `tsc --watch` for the shared package during dev so `.d.ts` files are regenerated. Vite's file watcher should pick up changes in `node_modules/@nova-imperia/shared` (which is a symlink to `packages/shared`).
**Warning signs:** Types are stale in the client after editing shared code; requires manual restart.

### Pitfall 4: `composite: true` Requires `declaration: true`
**What goes wrong:** TypeScript refuses to build with composite mode if `declaration` is not enabled.
**Why it happens:** Composite projects must emit `.d.ts` files for downstream references to consume.
**How to avoid:** Root tsconfig already has `declaration: true` and `composite: true`. Keep these. Per-package configs extend the root, inheriting these settings.
**Warning signs:** Build error: "Option 'composite' requires 'declaration' to be enabled."

### Pitfall 5: ESLint Flat Config `ignores` Must Be a Standalone Object
**What goes wrong:** Global ignores don't work when mixed with other config properties.
**Why it happens:** In ESLint flat config, a config object with ONLY `ignores` acts as a global ignore pattern. If `ignores` is combined with `rules` or other properties, it only applies to that specific config block.
**How to avoid:** Always put global ignores in their own object: `{ ignores: ['**/dist/', ...] }` as the first item in the config array.
**Warning signs:** Files in `dist/` or `node_modules/` being linted despite having ignores.

### Pitfall 6: Root package.json Scripts Conflict with Workspace Scripts
**What goes wrong:** `npm run lint` at root tries to run workspace lint scripts (which don't exist) instead of the root lint script.
**Why it happens:** npm workspaces can forward commands to workspaces. The root `package.json` currently uses `npm run dev --workspaces --if-present` pattern for some scripts.
**How to avoid:** Root scripts that run tools directly (like `eslint`, `prettier`) should invoke the tool, not forward to workspaces. The `dev` script should use `concurrently` directly at root. Only `build` and `typecheck` benefit from `--workspaces` forwarding.
**Warning signs:** Scripts run in unexpected packages or don't run at all.

## Code Examples

### Root package.json Scripts (Updated)
```json
{
  "scripts": {
    "dev": "concurrently --kill-others-on-fail --names CLIENT,SERVER,SHARED --prefix-colors blue,green,yellow \"npm run dev -w packages/client\" \"npm run dev -w packages/server\" \"npm run dev -w packages/shared\"",
    "build": "tsc --build && npm run build --workspaces --if-present",
    "typecheck": "tsc --build",
    "lint": "eslint packages/*/src/",
    "lint:fix": "eslint packages/*/src/ --fix",
    "format": "prettier --write \"packages/*/src/**/*.{ts,tsx}\"",
    "format:check": "prettier --check \"packages/*/src/**/*.{ts,tsx}\""
  }
}
```

### Client vite.config.ts
```typescript
// packages/client/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
  },
});
```

### Client index.html (Vite entry)
```html
<!-- packages/client/index.html -->
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Nova Imperia</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

### Shared Package dev Script
```json
{
  "scripts": {
    "dev": "tsc --watch --preserveWatchOutput",
    "build": "tsc",
    "typecheck": "tsc --noEmit"
  }
}
```

### .prettierrc
```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

### .prettierignore
```
dist/
node_modules/
*.tsbuildinfo
coverage/
```

### .nvmrc
```
20
```

### Package Boundary Test (MONO-06 verification)
```typescript
// If added to packages/shared/src/boundary-test.ts, this MUST produce a TypeScript error:
// import { something } from '@nova-imperia/client'; // Error: Cannot find module
// import { something } from '@nova-imperia/server'; // Error: Cannot find module

// This verifies that shared cannot import from client or server
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Vite with esbuild (dev) + Rollup (prod) | Vite 8 with unified Rolldown bundler | March 2026 | 10-30x faster production builds; single plugin system |
| ESLint legacy `.eslintrc` | ESLint flat config (`eslint.config.mjs`) | ESLint 9 (2024), required in ESLint 10 (Feb 2026) | Simpler config, better monorepo support |
| typescript-eslint `parserOptions.project` | typescript-eslint `parserOptions.projectService` | v8 (2024) | Auto-finds tsconfig per file; no monorepo-specific config needed |
| Building shared package for consumers | Source TypeScript resolution via `main`/`types` | TypeScript 5.x with `moduleResolution: "bundler"` | No build step needed for dev; instant type feedback |

**Deprecated/outdated:**
- **ESLint `.eslintrc` format**: Removed entirely in ESLint 10. Use `eslint.config.mjs` flat config.
- **`typescript-eslint` parserOptions.project with glob arrays**: Still works but `projectService` is simpler and recommended.
- **Vite 7**: Still supported but Vite 8 is stable and better for new projects.

## Open Questions

1. **Vite 8 vs. earlier research decision for Vite 7.3**
   - What we know: STATE.md records "Vite 7.3 over Vite 8" as a research decision. Vite 8.0.0 went stable on 2026-03-12 (9 days ago).
   - What's unclear: Whether the user has a strong preference for Vite 7.
   - Recommendation: Use Vite 8.0.1. The earlier decision was made when Vite 8 was in beta. It's now stable, with `@vitejs/plugin-react` v6, Vitest 4.1, and full plugin compatibility. There is no migration burden for a new project.

2. **Shared package `"type": "module"` omission**
   - What we know: Client and server have `"type": "module"` but shared does not.
   - What's unclear: Whether this omission is intentional or an oversight.
   - Recommendation: Do NOT add `"type": "module"` to shared. The shared package uses `main: "./src/index.ts"` which TypeScript resolves via `types` field. Adding `"type": "module"` could cause resolution issues in some edge cases. The existing setup works correctly.

3. **ESLint upgrade path to v10**
   - What we know: ESLint 10 has better monorepo support (file-based config lookup). `eslint-plugin-react-hooks` has a pending PR to add `^10.0.0` peerDep.
   - What's unclear: When the react-hooks plugin will release with ESLint 10 support.
   - Recommendation: Start with ESLint 9. Upgrade to 10 once all plugins officially support it (likely within weeks).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 (declared in shared package.json; not yet installed) |
| Config file | none -- see Wave 0 |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npm test` (forwards to workspaces) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MONO-01 | npm workspaces resolve across packages | smoke | `npm ls @nova-imperia/shared` (verify symlink) | N/A -- CLI check |
| MONO-02 | TypeScript compiles all packages strict | smoke | `npx tsc --build --dry` | N/A -- CLI check |
| MONO-03 | ESLint runs clean across all packages | smoke | `npx eslint packages/*/src/` | N/A -- CLI check |
| MONO-04 | Prettier formats consistently | smoke | `npx prettier --check "packages/*/src/**/*.{ts,tsx}"` | N/A -- CLI check |
| MONO-05 | Dev command starts client and server | manual-only | `npm run dev` then verify ports 5173 and 3000 respond | N/A -- manual verification |
| MONO-06 | Shared cannot import client/server | unit | Create test file with invalid import, verify `tsc --build` fails | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx tsc --build && npx eslint packages/*/src/ && npx prettier --check "packages/*/src/**/*.{ts,tsx}"`
- **Per wave merge:** Full build + lint + format check
- **Phase gate:** All 6 success criteria pass before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] Install Vitest as devDependency (already in shared scripts but not installed)
- [ ] No vitest.config.ts exists yet (not strictly needed for Phase 1 -- Phase 1 is about tooling, not test coverage)
- [ ] MONO-06 boundary test: create a test script or TypeScript file that attempts forbidden imports and verify compile failure

## Sources

### Primary (HIGH confidence)
- npm registry -- verified all package versions via `npm view <pkg> version` on 2026-03-21
- Existing repo files -- `package.json`, `tsconfig.json`, all per-package configs read directly
- [typescript-eslint monorepo docs](https://typescript-eslint.io/troubleshooting/typed-linting/monorepos/) -- projectService requires no extra config for monorepos
- [typescript-eslint dependency versions](https://typescript-eslint.io/users/dependency-versions/) -- supports `^8.57.0 || ^9.0.0 || ^10.0.0` for ESLint
- [ESLint v10 migration guide](https://eslint.org/docs/latest/use/migrate-to-10.0.0) -- breaking changes documented
- [Vite 8 release blog](https://vite.dev/blog/announcing-vite8) -- Rolldown bundler, Node.js 20.19+ required

### Secondary (MEDIUM confidence)
- [Colin McDonnell - Live types in a TypeScript monorepo](https://colinhacks.com/essays/live-types-typescript-monorepo) -- custom export conditions approach for shared packages
- [TypeScript docs - moduleResolution](https://www.typescriptlang.org/tsconfig/moduleResolution.html) -- `"bundler"` mode documentation
- [ESLint flat config discussion for monorepos](https://github.com/eslint/eslint/discussions/16960) -- single vs multiple config files

### Tertiary (LOW confidence)
- [eslint-plugin-react-hooks ESLint 10 PR](https://github.com/facebook/react/pull/35720) -- pending PR to add `^10.0.0` to peerDeps (not yet merged/released)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all versions verified against npm registry; peerDeps cross-checked
- Architecture: HIGH -- existing repo structure already follows recommended patterns; minimal changes needed
- Pitfalls: HIGH -- documented from official sources and known issues in the TypeScript/ESLint/Vite ecosystem
- Validation: MEDIUM -- Phase 1 is primarily CLI smoke tests rather than unit tests; boundary test approach is sound but needs implementation

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (stable ecosystem; ESLint 10 plugin ecosystem may shift faster)
