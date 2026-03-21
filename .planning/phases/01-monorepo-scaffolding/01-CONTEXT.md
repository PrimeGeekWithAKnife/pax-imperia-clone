# Phase 1: Monorepo Scaffolding - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Set up npm workspaces with TypeScript, ESLint, Prettier, Vite, and dev scripts so that a developer can create, build, and lint code across client, server, and shared packages from a single repository. No game logic, no rendering, no server endpoints — just the tooling foundation.

</domain>

<decisions>
## Implementation Decisions

### Dev Command Behavior
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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project design
- `PROJECT.md` — Full game design, milestone roadmap, and architectural decisions (Phaser 3 + React hybrid, npm workspaces, Vite)
- `docs/superpowers/specs/2026-03-21-nova-imperia-design.md` — Complete game design spec

### Existing scaffolding
- `packages/client/package.json` — Client package config (Vite, React JSX)
- `packages/server/package.json` — Server package config (tsx watch)
- `packages/shared/package.json` — Shared package config (vitest)
- `tsconfig.json` — Root TypeScript config with project references and composite build

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Root `package.json` with workspaces config and basic scripts — extend, don't replace
- Root `tsconfig.json` with project references, strict mode, composite, bundler resolution — extend per-package
- Per-package `tsconfig.json` files with correct extends and references — keep structure
- Per-package `package.json` files with `@nova-imperia/*` naming — keep naming

### Established Patterns
- ES modules throughout (`"type": "module"` in client and server)
- TypeScript project references for build ordering (shared -> client, shared -> server)
- Package naming: `@nova-imperia/client`, `@nova-imperia/server`, `@nova-imperia/shared`

### Integration Points
- Shared package `src/index.ts` re-exports from `./types` — barrel file pattern established
- Client depends on `@nova-imperia/shared: "*"` — workspace resolution
- Server depends on `@nova-imperia/shared: "*"` — workspace resolution

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. User wants Claude to make all technical decisions for this infrastructure phase.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-monorepo-scaffolding*
*Context gathered: 2026-03-21*
