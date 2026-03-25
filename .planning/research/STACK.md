# Technology Stack

**Project:** Nova Imperia (Pax Imperia: Eminent Domain Clone)
**Researched:** 2026-03-21
**Overall Confidence:** HIGH (all versions verified against npm registry)

## Recommended Stack

### Core Game Engine

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Phaser** | 3.90.0 (latest stable) | 2D game rendering, scene management, input, physics | Mature, battle-tested, massive community. v4 (RC6) is still pre-release on npm (`beta` tag). v3.90.0 is the final v3 release and rock-solid. Use this. |
| **React** | 19.2.4 | UI overlays (menus, HUD, dialogs, management screens) | Current stable. React 19 has been production-ready since Dec 2024. |
| **react-dom** | 19.2.4 | React DOM rendering | Must match React version. |
| **@types/react** | 19.2.14 | TypeScript types for React | Latest types matching React 19. |
| **@types/react-dom** | (latest) | TypeScript types for react-dom | Match to React version. |

### Build Tooling

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Vite** | 7.3.1 | Dev server, HMR, production builds | Vite 8.0.1 shipped 9 days ago with Rolldown replacing Rollup/esbuild -- too new for a foundation milestone. Vite 7.3 is proven, fast, and receives security patches. Upgrade to 8 in a later milestone after ecosystem stabilizes. |
| **@vitejs/plugin-react** | 6.0.1 | React Fast Refresh in Vite | Official React plugin. Works with Vite 7. |
| **TypeScript** | 5.9.3 | Language | Stable latest. TS 6.0 is RC (not stable). TS 7 (Go rewrite) is preview-only. 5.9.3 is production-ready with excellent tooling support. |

### Backend

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Fastify** | 5.8.2 | HTTP API server | Fastest Node.js framework. v5 is mature (released Oct 2024, now at 5.8). Plugin ecosystem is rich. |
| **Socket.io** | 4.8.3 | Real-time multiplayer communication | Battle-tested WebSocket abstraction with rooms, namespaces, auto-reconnection, binary support. Critical for real-time 4X game sync. |
| **socket.io-client** | 4.8.3 | Client-side Socket.io | Must match server version. |
| **fastify-socket.io** | 5.1.0 | Fastify-Socket.io integration plugin | Cleanly integrates Socket.io into Fastify's lifecycle. Avoids manual server sharing boilerplate. |
| **@fastify/cors** | 11.2.0 | CORS middleware | Required for dev (client/server on different ports). |
| **@fastify/cookie** | 11.0.2 | Cookie support | Session management for auth. |
| **@fastify/static** | 9.0.0 | Static file serving | Serve production client build from server. |
| **tsx** | 4.21.0 | TypeScript Node.js execution | Run server in dev without separate compile step. Faster than ts-node. |

### Database

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Drizzle ORM** | 0.45.1 | PostgreSQL ORM / query builder | SQL-first, zero-dependency, tiny (~7.4kb), full TypeScript inference. Schemas are plain TypeScript (no codegen step like Prisma). Perfect for a game where you want SQL control for complex queries (leaderboards, game state). |
| **drizzle-kit** | 0.31.10 | Migration generation and management | Companion CLI for schema migrations. Introspects DB, generates SQL migrations from schema diffs. |
| **pg** | (latest) | PostgreSQL client driver | Native PostgreSQL driver for Node.js. Used by Drizzle under the hood. |

### Shared Package

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Zod** | 4.3.6 | Runtime validation of game data, network messages | 14x faster parsing vs Zod 3. Built-in JSON Schema export. Validates JSON data files (tech trees, ship specs) and Socket.io message payloads. |

### Audio

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Phaser built-in audio** | (included) | Sound effects, music | Phaser 3 has its own SoundManager with Web Audio API support, spatial audio, audio sprites. Use this first -- it handles browser autoplay policies, mobile quirks, and integrates with scene lifecycle. Only add Howler.js if Phaser audio proves insufficient. |

**Note on Howler.js:** The PROJECT.md lists Howler.js, but it is in maintenance mode (last release 2+ years ago, v2.2.4). Phaser's built-in audio system is more actively maintained and already handles the same use cases. Defer Howler.js unless a concrete need arises (e.g., audio outside of Phaser scenes).

### Code Quality

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **ESLint** | 10.1.0 | Linting | v10 requires Node >= 20.19.0 (we have 20.19.4). Flat config is default. |
| **@eslint/js** | 10.0.1 | ESLint core recommended rules | Base rule set for JavaScript. |
| **typescript-eslint** | 8.57.1 | TypeScript ESLint integration | Unified package with flat config support. Replaces old @typescript-eslint/parser + plugin. |
| **Prettier** | 3.8.1 | Code formatting | Opinionated formatting. Keep it separate from ESLint (no eslint-plugin-prettier -- use Prettier independently). |

### Testing

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Vitest** | 4.1.0 | Unit and integration testing | Vite-native, same config as your build. Browser mode now stable for future Phaser scene testing. |

### Dev Tooling

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **concurrently** | 9.2.1 | Run client + server dev scripts in parallel | Simple, well-maintained. Run from root `npm run dev`. |

## Phaser 3 vs Phaser 4 Decision

**Recommendation: Use Phaser 3.90.0** (HIGH confidence)

| Factor | Phaser 3 | Phaser 4 |
|--------|----------|----------|
| npm tag | `latest` (stable) | `beta` (pre-release RC6) |
| npm version | 3.90.0 | 4.0.0-rc.6 |
| Documentation | Extensive, community-proven | Sparse, changing |
| React template | Official template available | Editor templates only (different integration) |
| Ecosystem plugins | Mature, hundreds available | Limited, early adoption |
| API compatibility | N/A | "Internal API is the same" per Phaser team |
| Renderer | WebGL/Canvas (proven) | Beam renderer (new, faster, but RC) |
| Active development | Maintenance only (final v3 release) | All new development goes here |

**Rationale:** Phaser 4's API is reportedly compatible with v3, but it is still tagged as `beta` on npm after 16 months of RC releases. For a foundation milestone, stability matters more than cutting-edge rendering. When Phaser 4 hits the `latest` npm tag, migration should be straightforward since the API surface is preserved. Plan to upgrade in Milestone 5 (Combat) when the new Beam renderer's particle effects would actually matter.

## Vite 7 vs Vite 8 Decision

**Recommendation: Use Vite 7.3.1** (HIGH confidence)

| Factor | Vite 7 | Vite 8 |
|--------|--------|--------|
| Released | Stable, months of patches | 9 days ago (March 12, 2026) |
| Bundler | esbuild + Rollup (proven) | Rolldown (Rust, new) |
| Config | `build.rollupOptions` | `build.rolldownOptions` (renamed) |
| Plugin compat | Broad ecosystem verified | "Most work" but untested at scale |
| Phaser compat | Known, documented workarounds | Unknown edge cases |

**Rationale:** Vite 8 is a massive architectural change (new bundler engine). For a greenfield project establishing its foundation, choosing a 9-day-old major release with a brand-new bundler is unnecessary risk. Vite 7 is fast, stable, and fully featured. Upgrade to Vite 8 once the ecosystem has had time to shake out bugs (target: 3-6 months).

## Drizzle ORM vs Prisma Decision

**Recommendation: Use Drizzle ORM** (HIGH confidence)

| Factor | Drizzle | Prisma |
|--------|---------|--------|
| Bundle size | ~7.4kb | Much larger (binary engine) |
| SQL control | Full SQL-like API | Abstracted query builder |
| Schema definition | TypeScript code | .prisma schema file + codegen |
| Type safety | TypeScript inference (instant) | Requires `prisma generate` step |
| Migrations | SQL-based via drizzle-kit | Prisma Migrate |
| Learning curve | Need SQL knowledge | Lower for non-SQL devs |

**Rationale:** A 4X game will need complex queries (aggregate stats, leaderboards, spatial data, game state snapshots). Drizzle gives SQL control without the ORM overhead. No codegen step means faster iteration. The schema-as-TypeScript approach fits naturally in a monorepo's shared types strategy.

## Monorepo Architecture

### npm Workspaces (not Yarn, not pnpm)

**Why npm workspaces:** Per project constraints. Already configured in root `package.json`. Node 20.19.4 has mature workspace support.

### Workspace Structure

```
packages/
  client/    # Phaser + React game client (Vite)
  server/    # Fastify + Socket.io server
  shared/    # Types, constants, Zod schemas, utilities
```

### TypeScript Project References

Use TypeScript project references (`composite: true`, `tsc --build`) for:
- Incremental compilation across packages
- Enforced package boundaries (shared cannot import from client)
- Proper declaration file generation for cross-package imports

### tsconfig Structure

```
tsconfig.json           # Root: references only (no compilerOptions)
tsconfig.base.json      # Base: shared compilerOptions (strict, ESNext, etc.)
packages/client/tsconfig.json    # Extends base, references shared
packages/server/tsconfig.json    # Extends base, references shared
packages/shared/tsconfig.json    # Extends base, composite: true
```

## React + Phaser Integration Pattern

Use the **official Phaser + React template pattern** (EventBus bridge):

1. **PhaserGame component** - React component that mounts the Phaser canvas via `useEffect`, manages game lifecycle
2. **EventBus** - Simple pub/sub (`Phaser.Events.EventEmitter`) shared between React and Phaser
3. **React renders UI** - Menus, HUD, management screens are React components overlaying the Phaser canvas
4. **Phaser renders game** - Galaxy map, system view, combat are Phaser scenes with their own update loops
5. **Communication is event-based** - Phaser scene emits "planet-selected" -> React shows planet detail panel. React dispatches "set-speed" -> Phaser game loop adjusts.

**Do NOT use:**
- `react-phaser-fiber` (unmaintained, Phaser 3 only, incomplete API)
- `phaser-react-ui` (small community, adds coupling complexity)
- iframe isolation (unnecessary overhead for this architecture)

**Do use:**
- Official `phaserjs/template-react-ts` as reference (but adapt to monorepo, not copy wholesale)

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Game engine | Phaser 3.90.0 | Phaser 4.0.0-rc.6 | Still pre-release on npm. Upgrade when stable. |
| Game engine | Phaser 3.90.0 | PixiJS 8 | Lower-level; no scene management, input, physics, audio. Would need to rebuild what Phaser provides. |
| Build tool | Vite 7.3.1 | Vite 8.0.1 | 9 days old, new Rolldown bundler untested at scale. Upgrade after stabilization. |
| Build tool | Vite 7.3.1 | Webpack 5 | Slower DX, more complex config, no HMR advantage over Vite. |
| Backend | Fastify 5.8 | Express 5 | Fastify is faster, better TypeScript support, better plugin architecture. |
| Real-time | Socket.io 4.8 | Plain WebSockets | Socket.io provides rooms, namespaces, reconnection, fallbacks -- all needed for multiplayer lobby/game. |
| ORM | Drizzle | Prisma 7 | Larger bundle, codegen step, less SQL control. |
| ORM | Drizzle | Raw pg queries | No type safety, no migration tooling. |
| Testing | Vitest 4.1 | Jest 30 | Vitest is Vite-native, same transforms, zero config in Vite project. |
| Linting | ESLint 10 | Biome | ESLint has broader TypeScript support, larger plugin ecosystem. Biome is fast but less mature for complex configs. |
| Audio | Phaser built-in | Howler.js 2.2.4 | Howler is maintenance-mode. Phaser's audio handles the same use cases and integrates with scene lifecycle. |
| Validation | Zod 4.3 | AJV + JSON Schema | Zod provides TypeScript inference from schemas. AJV is faster but no type inference without extra tooling. |

## Installation Commands

```bash
# Root (monorepo tooling)
npm install -D typescript@5.9.3 eslint@10.1.0 @eslint/js@10.0.1 typescript-eslint@8.57.1 prettier@3.8.1 concurrently@9.2.1

# packages/client
npm install phaser@3.90.0 react@19.2.4 react-dom@19.2.4 zod@4.3.6
npm install -D @vitejs/plugin-react@6.0.1 vite@7.3.1 @types/react@19.2.14 @types/react-dom vitest@4.1.0

# packages/server
npm install fastify@5.8.2 socket.io@4.8.3 fastify-socket.io@5.1.0 @fastify/cors@11.2.0 @fastify/cookie@11.0.2 @fastify/static@9.0.0 drizzle-orm@0.45.1 pg zod@4.3.6
npm install -D drizzle-kit@0.31.10 tsx@4.21.0 @types/pg vitest@4.1.0

# packages/shared
npm install zod@4.3.6
npm install -D vitest@4.1.0
```

**Note:** In an npm workspaces monorepo, shared devDependencies (TypeScript, ESLint, Prettier) live at root. Package-specific dependencies live in each package's `package.json`. Zod is a runtime dependency in all three packages.

## Deferred Technologies

These are listed in PROJECT.md but should NOT be installed in Milestone 0:

| Technology | When | Reason |
|------------|------|--------|
| Redis | Milestone 8 (Multiplayer) | Not needed until real-time state sync, matchmaking |
| Playwright | Milestone 9 (Polish) | E2E testing is premature during foundation |
| Docker | Milestone 10 (Launch) | Local dev is sufficient for now |
| GitHub Actions CI | Milestone 1+ | Not needed for initial scaffolding proof |

## Sources

- Phaser releases: [GitHub Releases](https://github.com/phaserjs/phaser/releases) | [Phaser Download](https://phaser.io/download/stable)
- Phaser npm dist-tags: Verified via `npm view phaser dist-tags` (latest: 3.90.0, beta: 4.0.0-rc.6)
- Official Phaser+React template: [phaserjs/template-react](https://github.com/phaserjs/template-react) | [Phaser announcement](https://phaser.io/news/2024/02/official-phaser-3-and-react-template)
- Phaser 4 status: [RC4 announcement](https://phaser.io/news/2025/05/phaser-v4-release-candidate-4) | [RC6 announcement](https://phaser.io/news/2025/12/phaser-v4-release-candidate-6-is-out)
- Vite 8 announcement: [Vite blog](https://vite.dev/blog/announcing-vite8) | [Migration guide](https://vite.dev/guide/migration)
- Vite releases: [Vite releases page](https://vite.dev/releases)
- Fastify: [Official site](https://fastify.dev/) | [GitHub releases](https://github.com/fastify/fastify/releases)
- Socket.io: [Official site](https://socket.io/) | [GitHub releases](https://github.com/socketio/socket.io/releases)
- TypeScript: [GitHub releases](https://github.com/microsoft/typescript/releases) | [TS 6.0 RC announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0-rc/)
- ESLint flat config: [typescript-eslint getting started](https://typescript-eslint.io/getting-started/)
- Drizzle vs Prisma: [Bytebase comparison](https://www.bytebase.com/blog/drizzle-vs-prisma/) | [Drizzle ORM docs](https://orm.drizzle.team/)
- Zod 4: [Release notes](https://zod.dev/v4) | [InfoQ coverage](https://www.infoq.com/news/2025/08/zod-v4-available/)
- All npm versions verified via `npm view [package] version` on 2026-03-21
