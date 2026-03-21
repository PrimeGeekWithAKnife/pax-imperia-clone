# Requirements: Nova Imperia — Milestone 0 (Foundation)

**Defined:** 2026-03-21
**Core Value:** A Phaser 3 game canvas renders in the browser with React UI overlays integrated and working — proving the hybrid rendering architecture.

## v1 Requirements

### Monorepo & Tooling

- [ ] **MONO-01**: npm workspaces resolve correctly across client, server, and shared packages
- [ ] **MONO-02**: TypeScript compiles cleanly with strict mode across all three packages
- [ ] **MONO-03**: ESLint flat config with typescript-eslint runs across all packages
- [ ] **MONO-04**: Prettier configured and formatting consistently
- [ ] **MONO-05**: Single `npm run dev` command starts client and server concurrently
- [ ] **MONO-06**: TypeScript project references enforce package boundaries (shared cannot import client/server)

### Shared Types

- [ ] **SHRD-01**: Shared package exports types importable by both client and server
- [ ] **SHRD-02**: Changing a type in shared causes compile errors in consuming packages
- [ ] **SHRD-03**: Vite hot-reloads when shared package types change (triple resolution validated)
- [ ] **SHRD-04**: Typed EventBus event map defined in shared (compile-time event name/payload safety)

### Phaser Client

- [ ] **PHAS-01**: Phaser 3 game instance renders WebGL canvas in browser
- [ ] **PHAS-02**: BootScene preloads placeholder assets with progress feedback
- [ ] **PHAS-03**: At least one GameScene renders after BootScene transition
- [ ] **PHAS-04**: Scene transitions work without memory leaks (BaseScene cleanup pattern)
- [ ] **PHAS-05**: Phaser game config externalized (not inline in React component)
- [ ] **PHAS-06**: React StrictMode enabled without creating dual Phaser instances (ref guard)

### React Integration

- [ ] **REAC-01**: React component renders visually over the Phaser canvas (CSS overlay)
- [ ] **REAC-02**: EventBus passes events from Phaser scene to React component (Phaser→React proof)
- [ ] **REAC-03**: EventBus passes events from React component to Phaser scene (React→Phaser proof)
- [ ] **REAC-04**: Mouse clicks on React UI elements do not trigger Phaser canvas input (pointer-events)
- [ ] **REAC-05**: Keyboard input reaches Phaser when canvas is focused, React when UI is focused

### Server

- [ ] **SERV-01**: Fastify server starts and responds to GET /health
- [ ] **SERV-02**: Socket.io accepts client WebSocket connection
- [ ] **SERV-03**: Server emits test event to connected client (bidirectional proof)
- [ ] **SERV-04**: Server imports and uses types from shared package

### Database

- [ ] **DB-01**: PostgreSQL connection established via Drizzle ORM (health check endpoint)
- [ ] **DB-02**: Drizzle schema defined in server package with at least one table
- [ ] **DB-03**: drizzle-kit migration generates and applies successfully

## v2 Requirements

### Dev Experience (deferred to post-foundation)

- **DX-01**: Camera controller with pan/zoom for strategy map scenes
- **DX-02**: Debug overlay with FPS counter (toggle with hotkey)
- **DX-03**: Responsive canvas sizing (handles window resize)
- **DX-04**: Configurable game loop speed (GameClock with timeScale)
- **DX-05**: TypeScript path aliases for clean imports

### Infrastructure (deferred)

- **INFR-01**: GitHub Actions CI pipeline
- **INFR-02**: Docker containerization
- **INFR-03**: Vitest test suite with coverage

## Out of Scope

| Feature | Reason |
|---------|--------|
| Galaxy generation | Milestone 1 |
| Species/race systems | Milestone 2 |
| Research/tech tree | Milestone 3 |
| Ship design | Milestone 4 |
| Combat | Milestone 5 |
| Diplomacy | Milestone 6 |
| AI | Milestone 7 |
| Multiplayer sync/rooms | Milestone 8 |
| Full ECS architecture | Phaser's built-in object system is sufficient |
| Global state management (Redux/Zustand) | EventBus + lightweight state sufficient for foundation |
| Audio system | No assets exist yet; defer to Milestone 9 |
| Modding/data pipeline | No game data to mod yet |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| *(populated during roadmap creation)* | | |

**Coverage:**
- v1 requirements: 22 total
- Mapped to phases: 0
- Unmapped: 22

---
*Requirements defined: 2026-03-21*
*Last updated: 2026-03-21 after initial definition*
