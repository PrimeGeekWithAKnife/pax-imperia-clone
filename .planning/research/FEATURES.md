# Feature Research

**Domain:** Web-based game engine foundation (Phaser 3 + React hybrid) for real-time 4X strategy game
**Researched:** 2026-03-21
**Confidence:** HIGH

## Feature Landscape

This document maps features specifically for **Milestone 0: Foundation** -- the scaffolding, tooling, and basic rendering that every subsequent milestone depends on. This is not a game features list; it is an engine foundation features list. The question is: "What must the scaffolding provide so that Milestone 1 (Galaxy Generation) and beyond can build on solid ground?"

### Table Stakes (Development Stalls Without These)

Features that are non-negotiable for the foundation. Without any one of these, subsequent milestones will hit friction or require rework.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Monorepo with npm workspaces** | Shared types between client/server. Single `npm install`, cross-package imports. Without this, type drift between packages is immediate. | LOW | Root `package.json` with `"workspaces": ["packages/*"]`. Already stubbed in repo. Need TypeScript project references in `tsconfig.build.json` for incremental builds. |
| **TypeScript compilation across all packages** | Type safety is the project's primary defense against a codebase this complex. Must compile cleanly end-to-end: shared -> client, shared -> server. | LOW | Needs base `tsconfig.base.json` with strict settings, per-package `tsconfig.json` extending it, and composite project references. Shared package must export types that both client and server can consume without build steps in dev. |
| **Vite dev server with HMR for client** | Fast iteration is the difference between making progress and quitting. Phaser + React + Vite HMR is proven by the official `phaserjs/template-react-ts`. Without HMR, every change requires a full reload and Phaser re-initialization (~2-5s penalty per edit). | LOW | Use `@vitejs/plugin-react` for React HMR. Phaser scenes do not hot-reload cleanly (game state is lost), but React overlay components do. This asymmetry is expected and acceptable. |
| **Phaser 3 game instance bootstrap** | The entire rendering pipeline depends on a properly configured `Phaser.Game` with correct canvas settings, WebGL context, and scene manager. This is the single most critical piece of foundation. | MEDIUM | Config must specify: `type: Phaser.AUTO` (WebGL with Canvas fallback), proper `parent` DOM element, `transparent: true` background (so React can render behind/over), `scale` mode for responsive sizing. FPS config with `target: 60` and delta smoothing. |
| **Scene management skeleton** | Milestone 1 needs at least GalaxyMapScene and StarSystemScene. Foundation must prove scenes can be registered, started, stopped, and transitioned. Without scene management, there is no game structure. | MEDIUM | Implement at minimum: BootScene (asset preloading), a placeholder GameScene (proves rendering works), and scene transition logic. Follow Phaser's lifecycle: `init()` -> `preload()` -> `create()` -> `update()`. Parallel scenes are critical later (HUD scene running alongside game scene). |
| **React overlay rendering over Phaser canvas** | The entire UI strategy depends on React components rendering on top of the Phaser canvas. Menus, HUD, dialogs, management screens -- all React. If this does not work, the architectural bet fails. | MEDIUM | React root mounts in a DOM element layered above the Phaser canvas via CSS (`position: absolute; pointer-events: none` on container, `pointer-events: auto` on interactive elements). Phaser canvas must have `transparent: true` or a solid background, with React elements overlaid via z-index. |
| **EventBus for Phaser-React communication** | Phaser and React are separate rendering pipelines. They must share state: scene changes, game events, UI actions. The official Phaser template uses an EventBus pattern; this is the proven approach. | LOW | Simple pub-sub: `EventBus.emit('event', data)` / `EventBus.on('event', handler)`. Phaser scenes emit `current-scene-ready` so React knows which scene is active. React emits UI actions (button clicks, menu selections) that Phaser scenes listen for. Use Phaser's built-in `Phaser.Events.EventEmitter` class. |
| **Fastify server bootstrap** | Server must start, accept HTTP requests, and be ready for Socket.io. Even for Milestone 0, proving the server runs validates the backend half of the monorepo. | LOW | Basic Fastify instance with health check endpoint (`GET /health`). TypeScript with tsx for dev, compiled for production. Import and use types from `@nova-imperia/shared`. |
| **Socket.io integration on server** | Real-time communication is needed by Milestone 8 (Multiplayer), but the socket infrastructure must be proven early. Late Socket.io integration into Fastify causes architectural rework. Use `fastify-socket.io` plugin. | LOW | Register `fastify-socket.io` plugin, verify WebSocket upgrade works, emit a test event. Client-side Socket.io client wrapper stubbed but not connected to game logic yet. |
| **Shared types package compiling and importable** | The `@nova-imperia/shared` package must be importable by both client and server with full type inference. This is the glue of the monorepo. Already has type stubs for Galaxy, Species, Ships. | LOW | Currently using `"main": "./src/index.ts"` which works with Vite's ability to resolve TS source directly. For server (tsx), same. No build step needed in dev. Must verify: `import { StarSystem } from '@nova-imperia/shared'` works in both client and server. |
| **Asset loading pipeline (Preloader scene)** | Every Phaser game needs a boot/preloader scene. Without it, assets load inline in game scenes, causing jank and race conditions. This is standard Phaser architecture. | LOW | BootScene/PreloaderScene with progress bar. Load placeholder assets (a star sprite, a background, basic UI elements) to prove the pipeline works. Real assets come in Milestone 1+. Use `this.load.on('progress', ...)` for loading feedback. |
| **Basic input handling** | Proving keyboard and mouse input works in the Phaser-React hybrid is essential. Strategy games are entirely input-driven. Must verify: Phaser receives input when canvas is focused, React receives input when UI is focused, no input conflicts. | LOW | Verify keyboard events reach Phaser scenes, mouse/pointer events work on game objects, and React components receive clicks/hovers without Phaser intercepting. The `pointer-events` CSS strategy handles most conflicts. Test with a clickable game object and a clickable React button coexisting. |
| **Dev environment (concurrent scripts, watching)** | Developers must run `npm run dev` and have client (Vite), server (tsx watch), and any watchers all running. Single-command startup is table stakes for developer experience. | LOW | Use `concurrently` or Vite's built-in proxy for client. Root `dev` script runs both workspaces. Server uses `tsx watch src/main.ts` for auto-restart on changes. |
| **ESLint + Prettier configuration** | Code quality tooling prevents style debates and catches errors early. Must be configured once at root level and work across all packages. | LOW | Root `.eslintrc` with TypeScript parser, `@typescript-eslint/eslint-plugin`. Prettier config in root. VS Code settings for format-on-save. Phaser and React specific rules as needed. |

### Differentiators (Quality of Life / Competitive Advantage)

Features that are not strictly required for Milestone 0 but significantly improve developer experience or set up later milestones for success. Build these if time allows; they pay dividends.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Camera controller with pan/zoom** | Strategy games require pan and zoom from day one of gameplay (Milestone 1). Building the camera controller in the foundation means Milestone 1 can focus on galaxy generation, not camera plumbing. Phaser 3 has excellent camera support: `camera.pan()`, `camera.setZoom()`, scroll wheel zoom, drag-to-pan. | MEDIUM | Implement as a reusable CameraController class. Mouse wheel zoom toward cursor position, middle-click or right-click drag to pan, keyboard arrow keys for pan. Camera bounds clamping. This will be reused in every scene (galaxy, system, combat). |
| **Debug overlay / FPS counter** | Real-time FPS display, scene inspector, and game object count. During all future development, performance visibility prevents silent regressions. The Phaser Debug Tool plugin provides this. | LOW | Use `game.loop.actualFps` for FPS display. Optionally integrate the community Phaser Debug Tool for scene/object inspection. Toggle with a hotkey (F12 or backtick). Show in dev mode only. |
| **Game state manager pattern** | A centralized, observable state container that both Phaser scenes and React UI can subscribe to. Without this, state synchronization becomes ad-hoc and buggy by Milestone 2-3. | MEDIUM | Not a full Redux/Zustand store -- that is overkill. A lightweight observable state class that emits events on change. Phaser scenes and React components subscribe via the EventBus. Pattern: `GameState.on('change:selectedSystem', handler)`. Replaces scattered global variables. |
| **Responsive canvas sizing** | The game must handle window resizes gracefully. Phaser's Scale Manager handles this, but it must be configured correctly for a hybrid layout where React UI may occupy sidebars or overlays. | LOW | Use `Phaser.Scale.RESIZE` mode so the canvas fills its container. Listen for container resize events (ResizeObserver). React layout controls the container dimensions, Phaser fills whatever space it gets. |
| **PostgreSQL connection with health check** | Milestone 0 scope includes "PostgreSQL connection setup." Proving the connection works now means Milestone 2 (species/empires persistence) starts immediately. | LOW | Use `pg` driver (node-postgres) or Drizzle ORM. Connection pool with retry logic. Health check endpoint: `GET /health/db` returns connection status. Credentials from environment variables. Run a simple `SELECT 1` to verify. |
| **Configurable game loop speed** | The original Pax Imperia had adjustable game speed (pause/slow/normal/fast). Building the time control abstraction in the foundation means all game logic written from Milestone 1 onward automatically respects speed settings. | MEDIUM | Wrap Phaser's update delta in a `GameClock` that applies a speed multiplier. `GameClock.timeScale` values: 0 (paused), 0.5 (slow), 1.0 (normal), 2.0 (fast), 4.0 (very fast). All game logic uses `GameClock.delta` instead of raw `delta`. Phaser's `this.time.timeScale` can help but does not affect scene `update()` delta, so a custom wrapper is needed. |
| **TypeScript path aliases** | Clean imports like `@client/scenes/GalaxyMap` instead of `../../../../scenes/GalaxyMap`. Small DX improvement that prevents import hell as the codebase grows. | LOW | Configure in `tsconfig.json` with `paths` and in `vite.config.ts` with `resolve.alias`. Must match between TypeScript and Vite for runtime resolution. |

### Anti-Features (Deliberately NOT Building in Foundation)

Features that seem useful or get requested early but are harmful at the foundation stage.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Full ECS (Entity Component System) architecture** | ECS is trendy in game dev discussions. Promises performance for thousands of entities. | Phaser 3 already has its own game object system (Sprites, Containers, Groups). Layering ECS on top creates two competing object models. A 4X strategy game has hundreds of entities, not thousands -- ECS cache performance gains are irrelevant at this scale. ECS adds significant architectural complexity and learning curve for a solo/small team project. | Use Phaser's built-in game object hierarchy. Organize with composition (attach components to game objects manually) if needed. Reassess only if profiling shows the object system is a bottleneck (it will not). |
| **Global state management library (Redux, Zustand, MobX)** | React developers instinctively reach for state management libraries. Game state needs to be shared. | The game state lives primarily in Phaser, not React. React only needs a thin slice of game state for UI rendering. A full state management library creates a second source of truth that must stay synchronized with Phaser's internal state. This synchronization is where bugs live. | Lightweight EventBus + a thin `GameState` observable class. React components subscribe to specific events. Game state is authoritative in Phaser scenes; React reads, never writes directly. If state management complexity grows (Milestone 3+), add Zustand for React-only UI state, keeping it separate from game state. |
| **CI/CD pipeline** | "Good engineering practice." PROJECT.md even lists it under Milestone 0. | Foundation is about proving rendering works. CI/CD adds no value until there are tests to run and deployments to make. Time spent on GitHub Actions is time not spent proving the Phaser-React hybrid works. | Defer to after Milestone 1 when there is actual code worth testing and deploying. Add a `.github/workflows` stub directory as a reminder. |
| **Docker containerization** | Reproducible environments, deployment readiness. | Local development is the only environment that matters at Milestone 0. Docker adds build complexity and slows the dev loop. The project runs on Node.js 20 with a remote PostgreSQL VM -- there is nothing to containerize yet. | Defer to Milestone 8-9 (multiplayer/polish) when deployment matters. Document Node.js version requirement in `package.json` engines field (already done). |
| **Full test suite** | "Test-driven development." Tests prevent regressions. | At the foundation stage, the API surface is unstable. Tests written now will be rewritten in Milestone 1 when actual game logic appears. Testing Phaser rendering is especially painful (requires headless browser or canvas mocking). Testing React components over Phaser is non-trivial. | Add Vitest config and write ONE test proving shared types compile. Add Playwright config stub. Write real tests starting Milestone 1 when interfaces stabilize. |
| **Phaser 4 / WebGPU** | Phaser 4 is in beta (as of early 2025). WebGPU promises better performance. | Phaser 4 is not production-ready. APIs are unstable and changing between betas. The ecosystem (plugins, community examples, Stack Overflow answers) is entirely Phaser 3. Switching now means building on shifting sand with no community support. | Use Phaser 3 (v3.85+). Monitor Phaser 4 progress. Migration path exists when Phaser 4 reaches stable. WebGL2 is sufficient for a 2D strategy game. |
| **Multiplayer networking in foundation** | "Build for multiplayer from day one" per the design pillars. | Socket.io integration is table stakes (proving it works). But building game state synchronization, room management, or authoritative server logic now is premature. There is no game state to synchronize. This is Milestone 8 scope. | Stub the Socket.io connection. Prove client connects and receives a test event. All game logic from Milestones 1-7 runs single-player / locally. Multiplayer sync is retrofitted in Milestone 8 with the benefit of knowing what the actual game state looks like. |
| **Audio system (Howler.js)** | PROJECT.md lists Howler.js in the tech stack. Space games need ambiance. | No audio assets exist. No scenes produce events that need sound feedback. Adding Howler.js initialization is trivial and can be done in 15 minutes when audio is actually needed (Milestone 9 or whenever sound assets arrive). | Defer entirely. The Phaser built-in audio system may suffice for basic needs anyway, avoiding a redundant dependency. Evaluate Howler.js vs Phaser Audio when audio work begins. |
| **Custom event system replacing Phaser's built-in** | "Phaser's event system is too simple for complex games." | Phaser's `Phaser.Events.EventEmitter` is perfectly adequate. It supports `.on()`, `.once()`, `.off()`, `.emit()` with type-safe wrappers possible in TypeScript. Building a custom event system introduces a maintenance burden and diverges from Phaser conventions that community examples follow. | Use Phaser's EventEmitter as the EventBus. Wrap it with TypeScript generics for type-safe event names/payloads if desired. Only replace if a concrete limitation is hit. |
| **Modding/data-file system** | PROJECT.md envisions JSON-driven moddable data. | No game data exists to mod. Building a data loading pipeline for tech trees, ship specs, and race definitions is Milestone 1-3 scope. Premature abstraction here means building infrastructure for data shapes that do not exist yet. | JSON data loading is trivial in TypeScript. Build the data pipeline when the first real data file (galaxy generation config, Milestone 1) needs it. Use Zod for runtime validation at that point, not before. |

## Feature Dependencies

```
[Monorepo + npm workspaces]
    +-- [TypeScript compilation]
    |       +-- [Shared types package]
    |               +-- [Client imports shared types]
    |               +-- [Server imports shared types]
    |
    +-- [Vite dev server]
    |       +-- [Phaser 3 game instance]
    |       |       +-- [Scene management skeleton]
    |       |       |       +-- [Asset loading pipeline (BootScene)]
    |       |       |       +-- [Basic input handling]
    |       |       |       +-- [Camera controller] (differentiator)
    |       |       |
    |       |       +-- [React overlay rendering]
    |       |               +-- [EventBus for Phaser-React comms]
    |       |               |       +-- [Game state manager] (differentiator)
    |       |               |
    |       |               +-- [Debug overlay] (differentiator)
    |       |
    |       +-- [Responsive canvas sizing] (differentiator)
    |
    +-- [ESLint + Prettier]
    +-- [Dev environment (concurrent scripts)]

[Fastify server bootstrap]
    +-- [Socket.io integration]
    +-- [PostgreSQL connection] (differentiator)
```

### Dependency Notes

- **Monorepo is the root dependency:** Everything else builds on the workspace structure being correct. If npm workspaces resolve incorrectly, nothing works. This is step zero.
- **TypeScript compilation gates shared types:** The shared package must compile and export types before client or server can import them. In dev mode, Vite resolves TS source directly (no build step), but the tsconfig must be correct.
- **Phaser instance requires Vite:** Phaser is loaded as an npm dependency and bundled by Vite. The Vite config must handle Phaser's CommonJS exports correctly.
- **React overlay requires Phaser instance:** React renders over the Phaser canvas. The DOM structure (canvas element + React root element) must be established before either framework initializes.
- **EventBus requires both Phaser and React:** The bridge only makes sense when both sides exist. But it is architecturally simple (a standalone module) so it has no hard technical dependency.
- **Scene management requires Phaser instance:** Scenes register with the Phaser game config. Cannot test scene transitions without a running game.
- **Camera controller requires scene management:** Cameras belong to scenes. The controller attaches to a scene's camera.
- **Game state manager requires EventBus:** State changes propagate via events to both Phaser scenes and React components.
- **Server features (Fastify, Socket.io, PostgreSQL) are independent** of client features. Can be developed in parallel.

## MVP Definition

### Launch With (Milestone 0 Complete)

Minimum viable foundation -- what is needed to declare the foundation done and start Milestone 1.

- [x] Monorepo with npm workspaces resolving correctly across all three packages
- [x] TypeScript compiling cleanly across shared, client, and server
- [ ] Vite dev server running with HMR for React components
- [ ] Phaser 3 game instance rendering to canvas with WebGL
- [ ] At least 2 scenes (Boot/Preloader + placeholder Game) with transition between them
- [ ] React component rendering over the Phaser canvas (e.g., a "Hello Nova Imperia" overlay)
- [ ] EventBus passing events between Phaser scene and React component (bidirectional proof)
- [ ] Fastify server starting and responding to health check
- [ ] Socket.io accepting a client connection and emitting a test event
- [ ] Shared types imported and used in both client and server code
- [ ] `npm run dev` starts everything with a single command
- [ ] ESLint and Prettier configured and passing

### Add After Validation (Before Starting Milestone 1)

Features to add once the core foundation is proven, before diving into galaxy generation.

- [ ] Camera controller with pan/zoom -- Milestone 1 needs this immediately for the galaxy map
- [ ] Debug overlay with FPS counter -- needed during Milestone 1 development to catch perf issues
- [ ] Responsive canvas sizing -- needed when building real game views
- [ ] PostgreSQL connection verified -- needed before Milestone 2 (species persistence)
- [ ] Basic game state manager pattern -- prevents ad-hoc state chaos from Milestone 1 onward
- [ ] Configurable game loop speed (GameClock) -- all Milestone 1+ game logic should use this from the start

### Future Consideration (Milestone 2+)

Features to defer until they are actually needed.

- [ ] Full audio system -- Milestone 9 (Polish) unless audio assets arrive earlier
- [ ] CI/CD pipeline -- After Milestone 1 when there are tests to run
- [ ] Docker containerization -- Milestone 8-9 when deployment matters
- [ ] Comprehensive test suite -- Build incrementally starting Milestone 1
- [ ] Data loading pipeline with Zod validation -- Milestone 1 (galaxy config is first real data)
- [ ] Zustand or similar for React-only UI state -- Only if EventBus pattern proves insufficient

## Feature Prioritization Matrix

| Feature | Dev Value | Implementation Cost | Priority |
|---------|-----------|---------------------|----------|
| Monorepo + workspaces | HIGH | LOW | P1 |
| TypeScript compilation | HIGH | LOW | P1 |
| Vite dev server + HMR | HIGH | LOW | P1 |
| Phaser 3 game instance | HIGH | MEDIUM | P1 |
| Scene management skeleton | HIGH | MEDIUM | P1 |
| React overlay rendering | HIGH | MEDIUM | P1 |
| EventBus (Phaser-React comms) | HIGH | LOW | P1 |
| Fastify server bootstrap | MEDIUM | LOW | P1 |
| Socket.io integration | MEDIUM | LOW | P1 |
| Shared types package | HIGH | LOW | P1 |
| Asset loading pipeline | MEDIUM | LOW | P1 |
| Basic input handling proof | MEDIUM | LOW | P1 |
| Dev environment (concurrent) | HIGH | LOW | P1 |
| ESLint + Prettier | MEDIUM | LOW | P1 |
| Camera controller (pan/zoom) | HIGH | MEDIUM | P2 |
| Debug overlay / FPS | MEDIUM | LOW | P2 |
| Responsive canvas sizing | MEDIUM | LOW | P2 |
| PostgreSQL connection | MEDIUM | LOW | P2 |
| Game state manager pattern | MEDIUM | MEDIUM | P2 |
| Configurable game speed | MEDIUM | MEDIUM | P2 |
| TypeScript path aliases | LOW | LOW | P2 |

**Priority key:**
- P1: Must have -- foundation is incomplete without it
- P2: Should have -- significantly improves Milestone 1 readiness
- P3: Nice to have -- defer without consequence

## Competitor/Reference Feature Analysis

Relevant open-source Phaser + React projects and their architectural choices, informing our foundation decisions.

| Feature | Official Phaser-React Template | 3ee Games (Phaser+React blog) | Typical Phaser-only Games | Our Approach |
|---------|-------------------------------|-------------------------------|---------------------------|--------------|
| **React-Phaser bridge** | EventBus (Phaser EventEmitter) | DOM addEventListener | N/A (no React) | EventBus (matches official template, proven pattern) |
| **Scene management** | Scene list in game config, `current-scene-ready` event | Phaser as headless engine | Standard Phaser scenes | Standard Phaser scenes with `current-scene-ready` EventBus emission |
| **State management** | React state via refs, no global store | React hooks, DOM events | Phaser registry or globals | Lightweight GameState observable + EventBus |
| **Build tooling** | Vite | Next.js | Webpack or Parcel | Vite (matches official template, fastest HMR) |
| **Canvas strategy** | Phaser renders in div, React overlays | Phaser headless, React renders all UI | Full canvas | Phaser canvas with React overlay via CSS z-index |
| **Input partitioning** | Not addressed explicitly | Phaser game, React UI separate | All input to Phaser | CSS pointer-events strategy: React UI catches clicks, Phaser canvas catches game input |
| **TypeScript** | Full TypeScript template available | JavaScript example | Mixed | Full TypeScript with strict mode |
| **Monorepo** | Single package | Single package | Single package | npm workspaces monorepo (client/server/shared) -- unique to our project due to multiplayer goal |

## Sources

- [Official Phaser 3 + React TypeScript Template](https://github.com/phaserjs/template-react-ts) -- PRIMARY reference for hybrid architecture (HIGH confidence)
- [Phaser Docs: Scenes](https://docs.phaser.io/phaser/concepts/scenes) -- Scene lifecycle and management (HIGH confidence)
- [Phaser Docs: Input](https://docs.phaser.io/phaser/concepts/input) -- Input handling patterns (HIGH confidence)
- [Phaser Docs: Cameras](https://docs.phaser.io/phaser/concepts/cameras) -- Camera system capabilities (HIGH confidence)
- [Phaser Docs: Loader](https://docs.phaser.io/phaser/concepts/loader) -- Asset loading pipeline (HIGH confidence)
- [Phaser Docs: TimeStep](https://docs.phaser.io/api-documentation/class/core-timestep) -- Game loop timing (HIGH confidence)
- [3ee Games: Phaser game with a React UI](https://3ee.com/blog/phaser-game-react-ui/) -- Alternative hybrid architecture approach (MEDIUM confidence)
- [fastify-socket.io npm package](https://www.npmjs.com/package/fastify-socket.io) -- Fastify + Socket.io integration (HIGH confidence)
- [Phaser Debug Tool](https://phaser.io/news/2024/10/phaser-debug-tool) -- Debug overlay capabilities (MEDIUM confidence)
- [npm workspaces monorepo with TypeScript](https://medium.com/@cecylia.borek/setting-up-a-monorepo-using-npm-workspaces-and-typescript-project-references-307841e0ba4a) -- Monorepo patterns (MEDIUM confidence)
- [Web Game Dev: ECS](https://www.webgamedev.com/code-architecture/ecs) -- ECS vs OOP analysis informing anti-feature decision (MEDIUM confidence)

---
*Feature research for: Web-based game engine foundation (Phaser 3 + React hybrid)*
*Researched: 2026-03-21*
