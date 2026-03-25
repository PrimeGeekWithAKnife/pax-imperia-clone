# Research Summary: Nova Imperia (Stack Focus)

**Domain:** Web-based real-time 4X space strategy game
**Researched:** 2026-03-21
**Overall confidence:** HIGH (all package versions verified against npm registry)

## Executive Summary

Nova Imperia's technology stack is well-positioned for 2026. The core architectural bet -- Phaser 3 for game rendering with React for UI overlays -- is a proven pattern with an official template from Phaser Studio. The key strategic decision is choosing stability over bleeding edge: Phaser 3.90.0 over Phaser 4 (still RC on npm), Vite 7.3 over Vite 8 (9 days old), and TypeScript 5.9 over TypeScript 6.0 (RC). Each of these newer versions is a straightforward upgrade path when they stabilize.

The backend stack (Fastify 5.8 + Socket.io 4.8 + PostgreSQL via Drizzle ORM) is mature and production-ready. Drizzle ORM was chosen over Prisma for its SQL-first approach, zero codegen step, and tiny bundle size -- all advantages for a game that will need complex queries for leaderboards, game state serialization, and aggregate statistics.

The monorepo uses npm workspaces with TypeScript project references. The shared package exports types, Zod schemas, and utilities consumed by both client and server. This is the standard pattern for TypeScript monorepos in 2026, with well-documented solutions for the known Vite + workspace symlink resolution issues.

One notable deviation from PROJECT.md: Howler.js is deferred in favor of Phaser's built-in audio system. Howler.js has been in maintenance mode for 2+ years, while Phaser's SoundManager is actively maintained and handles the same use cases with better scene lifecycle integration.

## Key Findings

**Stack:** Phaser 3.90.0 + React 19.2.4 + Vite 7.3.1 + TypeScript 5.9.3 + Fastify 5.8.2 + Socket.io 4.8.3 + Drizzle ORM 0.45.1 -- all verified current stable versions.

**Architecture:** EventBus bridge pattern (official Phaser template) for React-Phaser communication, with a lightweight client-side state store and server-authoritative game simulation.

**Critical pitfall:** Triple import resolution mismatch (npm workspaces + TypeScript + Vite) must be solved first in Milestone 0 or nothing else works.

## Implications for Roadmap

Based on research, suggested phase structure for Milestone 0 (Foundation):

1. **Phase 1: Monorepo + Shared Package** - Establish npm workspaces, TypeScript project references, base tsconfig, ESLint, Prettier. Shared package compiles and exports types. This is the root dependency for everything.
   - Addresses: Monorepo setup, TypeScript compilation, shared types
   - Avoids: Triple import resolution mismatch (Pitfall 5)

2. **Phase 2: Phaser 3 Bootstrap** - Phaser.Game config, BootScene, one placeholder GameScene. Pure Phaser, no React yet. Canvas renders with WebGL.
   - Addresses: Phaser 3 client bootstrap, scene management
   - Avoids: React StrictMode dual instances (Pitfall 1) by proving Phaser works alone first

3. **Phase 3: React Shell + Bridge** - React entry point, PhaserGame bridge component, EventBus. React renders over Phaser canvas with proper input partitioning.
   - Addresses: React UI overlay integration, EventBus communication
   - Avoids: Input focus war (Pitfall 2), untyped EventBus (Pitfall 3)

4. **Phase 4: Server Bootstrap** - Fastify + Socket.io server, health check endpoint, PostgreSQL connection via Drizzle. Can be built in parallel with Phases 2-3.
   - Addresses: Node.js server bootstrap, PostgreSQL connection
   - Avoids: Late Socket.io integration requiring architectural rework

5. **Phase 5: Integration Proof** - Client connects to server via Socket.io. Typed events flow bidirectionally. `npm run dev` starts everything. The architectural bet is validated.
   - Addresses: Dev environment, end-to-end proof
   - Avoids: Game logic in scenes (Pitfall 7) by establishing the engine/renderer boundary

**Phase ordering rationale:**
- Shared package first because both client and server depend on it
- Phaser before React because React overlay depends on Phaser canvas existing
- Server can be built in parallel with client (Phase 4 alongside Phases 2-3)
- Integration proof last because it depends on all other phases

**Research flags for phases:**
- Phase 1: Import resolution across three systems needs careful testing (Pitfall 5)
- Phase 3: React StrictMode + Phaser lifecycle is the most documented source of bugs
- Phase 4: Standard pattern, unlikely to need research
- Planned Phaser 3->4 upgrade: Target Milestone 5 (Combat) when Beam renderer matters

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack versions | HIGH | All versions verified via `npm view` on 2026-03-21 |
| Phaser 3 vs 4 decision | HIGH | npm dist-tags confirm v4 is still pre-release (beta tag) |
| Vite 7 vs 8 decision | HIGH | Vite 8 is 9 days old; proven too new for foundation |
| Drizzle vs Prisma | HIGH | Multiple 2026 comparison sources agree on Drizzle for SQL-first projects |
| React+Phaser integration | HIGH | Official template exists with documented EventBus pattern |
| Monorepo patterns | MEDIUM | Well-documented but triple resolution issue requires careful validation |
| Audio (Howler vs Phaser built-in) | MEDIUM | Phaser audio is capable but less documented for complex audio needs |

## Gaps to Address

- **Phaser 4 migration path specifics:** When v4 hits `latest` on npm, a detailed migration guide should be researched for the project's specific scene patterns
- **Vite 8 compatibility:** Re-evaluate in 3-6 months when Rolldown has broader ecosystem testing
- **State management at scale:** The lightweight EventBus + state store pattern is proven for small-medium games; may need Zustand or similar for React UI state at Milestone 3+ complexity
- **Audio architecture:** Phaser built-in audio is recommended now, but spatial audio for combat may warrant re-evaluating Howler.js or Web Audio API directly in Milestone 9
