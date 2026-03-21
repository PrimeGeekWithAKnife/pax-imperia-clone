# Roadmap: Nova Imperia — Milestone 0 (Foundation)

## Overview

This milestone proves the core architectural bet: Phaser 3 game rendering with React UI overlays in a TypeScript monorepo. The journey moves from bare scaffolding to a working hybrid client connected to a Fastify + Socket.io server with PostgreSQL persistence. Each phase delivers a verifiable capability that the next phase depends on, culminating in bidirectional typed events flowing between browser and server.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Monorepo Scaffolding** - npm workspaces, TypeScript, linting, formatting, and dev scripts
- [ ] **Phase 2: Shared Types Package** - Cross-package type exports, compile-time safety, and typed EventBus
- [ ] **Phase 3: Phaser Bootstrap** - Game canvas renders with scene management and lifecycle patterns
- [ ] **Phase 4: React Integration** - React overlays on Phaser canvas with bidirectional EventBus communication
- [ ] **Phase 5: Server Bootstrap** - Fastify + Socket.io server with typed shared imports
- [ ] **Phase 6: Database Layer** - PostgreSQL connection via Drizzle ORM with schema and migrations

## Phase Details

### Phase 1: Monorepo Scaffolding
**Goal**: Developer can create, build, and lint code across client, server, and shared packages from a single repository
**Depends on**: Nothing (first phase)
**Requirements**: MONO-01, MONO-02, MONO-03, MONO-04, MONO-05, MONO-06
**Success Criteria** (what must be TRUE):
  1. Running `npm install` at the repo root resolves dependencies for all three packages (client, server, shared)
  2. Running `npx tsc --build` compiles all three packages with zero errors in strict mode
  3. ESLint and Prettier report clean across all packages with a single command
  4. Running `npm run dev` starts both client and server with hot reload active
  5. Importing from client or server inside the shared package produces a TypeScript compile error
**Plans**: TBD

Plans:
- [ ] 01-01: TBD
- [ ] 01-02: TBD

### Phase 2: Shared Types Package
**Goal**: Types defined once in the shared package are consumed by both client and server with compile-time enforcement
**Depends on**: Phase 1
**Requirements**: SHRD-01, SHRD-02, SHRD-03, SHRD-04
**Success Criteria** (what must be TRUE):
  1. Client and server can import types from the shared package and use them in their own code
  2. Changing a type signature in shared causes immediate compile errors in consuming packages
  3. Editing a shared type triggers Vite hot-reload in the client dev server without manual restart
  4. EventBus event map is defined in shared so that emitting an unknown event name or wrong payload type is a compile error
**Plans**: TBD

Plans:
- [ ] 02-01: TBD

### Phase 3: Phaser Bootstrap
**Goal**: A Phaser 3 game canvas renders in the browser with working scene management and clean lifecycle patterns
**Depends on**: Phase 2
**Requirements**: PHAS-01, PHAS-02, PHAS-03, PHAS-04, PHAS-05, PHAS-06
**Success Criteria** (what must be TRUE):
  1. Opening the client URL in a browser shows a Phaser WebGL canvas rendering content
  2. A BootScene displays loading progress then transitions to a GameScene automatically
  3. Navigating between scenes does not leak event listeners or Phaser objects (BaseScene cleanup)
  4. Phaser game config lives in a separate file, not inline in any React component
  5. React StrictMode is enabled and only one Phaser.Game instance exists (verified by ref guard)
**Plans**: TBD

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD

### Phase 4: React Integration
**Goal**: React components render over the Phaser canvas with bidirectional communication and correct input routing
**Depends on**: Phase 3
**Requirements**: REAC-01, REAC-02, REAC-03, REAC-04, REAC-05
**Success Criteria** (what must be TRUE):
  1. A React UI component is visually visible on top of the Phaser canvas (CSS overlay confirmed)
  2. A Phaser scene event (e.g., score change) updates a React component in real time via EventBus
  3. A React button click sends a command to the active Phaser scene via EventBus
  4. Clicking a React UI button does not trigger a click handler in the Phaser canvas underneath
  5. Keyboard input reaches Phaser when the canvas is focused and React when a UI input is focused
**Plans**: TBD

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD

### Phase 5: Server Bootstrap
**Goal**: A Fastify + Socket.io server accepts WebSocket connections and exchanges typed events with the client
**Depends on**: Phase 2
**Requirements**: SERV-01, SERV-02, SERV-03, SERV-04
**Success Criteria** (what must be TRUE):
  1. GET /health returns a 200 response from the Fastify server
  2. The client establishes a Socket.io WebSocket connection to the server on page load
  3. Server emits a typed test event that the client receives and can display
  4. Server code imports and uses types from the shared package without errors
**Plans**: TBD

Plans:
- [ ] 05-01: TBD

### Phase 6: Database Layer
**Goal**: PostgreSQL is connected via Drizzle ORM with a working schema and migration pipeline
**Depends on**: Phase 5
**Requirements**: DB-01, DB-02, DB-03
**Success Criteria** (what must be TRUE):
  1. GET /health includes a database connectivity check that confirms PostgreSQL is reachable
  2. At least one Drizzle schema table is defined and queryable from server code
  3. Running `drizzle-kit generate` and `drizzle-kit migrate` creates and applies a migration to the database
**Plans**: TBD

Plans:
- [ ] 06-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 (and 5 in parallel with 3-4) -> 5 -> 6

Note: Phase 5 (Server) depends only on Phase 2, so it can be built in parallel with Phases 3-4 (client work).

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Monorepo Scaffolding | 0/2 | Not started | - |
| 2. Shared Types Package | 0/1 | Not started | - |
| 3. Phaser Bootstrap | 0/2 | Not started | - |
| 4. React Integration | 0/2 | Not started | - |
| 5. Server Bootstrap | 0/1 | Not started | - |
| 6. Database Layer | 0/1 | Not started | - |
