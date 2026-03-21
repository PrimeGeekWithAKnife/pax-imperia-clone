# Nova Imperia — Milestone 0: Foundation

## What This Is

A modern web-based clone of Pax Imperia: Eminent Domain (1997), the real-time 4X space strategy game. Nova Imperia reimagines the game with modern tech: TypeScript monorepo, Phaser 3 for game rendering, React for UI overlays, Fastify + Socket.io server, and PostgreSQL for persistence. This milestone establishes the project foundation — scaffolding, tooling, and basic rendering.

## Core Value

A Phaser 3 game canvas renders in the browser with React UI overlays integrated and working — proving the hybrid rendering architecture that the entire game depends on.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Monorepo setup with npm workspaces, TypeScript, Vite, ESLint
- [ ] Phaser 3 client bootstrap with basic scene management
- [ ] React UI overlay integration (React components rendered over Phaser canvas)
- [ ] Node.js server bootstrap with Fastify + Socket.io
- [ ] Shared types package compiling and usable by client and server
- [ ] Basic dev environment (hot reload, concurrent dev scripts)
- [ ] PostgreSQL connection setup (VM at 192.168.1.3 available)

### Out of Scope

- Galaxy generation — Milestone 1
- Species/race systems — Milestone 2
- Research/tech tree — Milestone 3
- Ship design — Milestone 4
- Combat — Milestone 5
- Diplomacy — Milestone 6
- AI — Milestone 7
- Multiplayer sync — Milestone 8
- CI/CD pipeline — deferred, not needed for foundation proof
- Docker setup — deferred, local dev sufficient
- Full test suite — deferred, focus on working rendering first

## Context

- **Existing code**: Scaffolding exists in packages/shared (type stubs for galaxy, ships, species), packages/client (main.ts), packages/server (main.ts). Not yet functional.
- **Original game**: Pax Imperia: Eminent Domain (1997) by Heliotrope Studios/THQ. Real-time 4X with wormhole galaxy topology, ship design, 300+ techs. Known for streamlined interface.
- **Full game design**: See `/home/api/pax-imperia-clone/PROJECT.md` for complete original game research, modern vision, and full milestone roadmap (Milestones 0-10).
- **Infrastructure**: PostgreSQL VM available at 192.168.1.3 (proxmox), credentials in /HITCAN. Additional DB credentials stored there.

## Constraints

- **Tech stack**: TypeScript, Phaser 3, React, Vite, Fastify, Socket.io, PostgreSQL — per PROJECT.md design decisions
- **Runtime**: Node.js 20.19.4 available, no Rust/Go/Java
- **Monorepo**: npm workspaces (not yarn/pnpm)
- **Rendering**: Phaser 3 canvas with React overlay — this hybrid approach is the key architectural bet

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Phaser 3 + React hybrid | Phaser for game rendering, React for UI (menus, HUD, dialogs) | — Pending |
| npm workspaces monorepo | Shared types between client/server, single repo | — Pending |
| Vite for bundling | Fast HMR, good Phaser/React support | — Pending |
| PostgreSQL from start | Available infrastructure, needed for accounts/sessions eventually | — Pending |

---
*Last updated: 2026-03-21 after initialization*
