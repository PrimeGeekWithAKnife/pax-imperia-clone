# Pitfalls Research

**Domain:** Web-based 4X space strategy game (Phaser 3 + React hybrid, TypeScript monorepo)
**Researched:** 2026-03-21
**Confidence:** HIGH (official templates, documented GitHub issues, community post-mortems)

## Critical Pitfalls

### Pitfall 1: React StrictMode Creates Dual Phaser Game Instances

**What goes wrong:**
React 18+ StrictMode intentionally double-mounts components in development. When a Phaser game is initialized inside a `useEffect`, this creates two separate Phaser.Game instances attached to the same DOM container. The result is two canvases stacked on each other, double input handling, double RAF loops, and eventually crashes or bizarre rendering artifacts.

**Why it happens:**
StrictMode re-runs effects to surface missing cleanup logic. Phaser's `new Phaser.Game(config)` immediately creates a canvas element and starts its game loop. Most developers do not realize they need to handle the cleanup return path in useEffect, or that StrictMode will exercise it on every mount during development.

**How to avoid:**
- Use a ref guard (`const initialized = useRef(false)`) to prevent double initialization
- Implement proper cleanup: `return () => { game.destroy(true) }` in useEffect
- Follow the official `phaserjs/template-react-ts` pattern where PhaserGame uses `forwardRef` and manages the instance lifecycle explicitly
- Do NOT simply remove StrictMode to "fix" the problem -- that hides real bugs

**Warning signs:**
- Two canvas elements visible in the DOM inspector under the game container
- Doubled frame rate (120fps instead of 60fps) in dev tools
- Input events firing twice
- "Cannot read property 'update' of null" errors during hot reload

**Phase to address:**
Milestone 0 (Foundation) -- this must be correct from the first line of Phaser+React integration code.

---

### Pitfall 2: Input Focus War Between Phaser Canvas and React UI Overlays

**What goes wrong:**
Phaser captures keyboard input globally by default. When React UI overlays (menus, dialogs, text inputs) are rendered on top of the Phaser canvas, keyboard events intended for React components get swallowed by Phaser. Conversely, mouse/pointer events pass *through* HTML overlays and hit the Phaser canvas underneath, causing unintended game interactions while the player is clicking UI buttons.

**Why it happens:**
Phaser's KeyboardPlugin sets `preventDefault = true` by default, capturing all keyboard events document-wide. The canvas and DOM overlay exist in separate rendering contexts with no automatic coordination. Phaser's input system does not know about HTML elements layered above it.

**How to avoid:**
- Set `input.keyboard.capture` only for specific keys, not globally
- Use `this.input.keyboard.enabled = false` when React overlays are active
- Apply `pointer-events: none` to the React overlay container by default, then `pointer-events: auto` only on interactive React elements
- Use `stopPropagation()` on React click handlers to prevent events from reaching the canvas
- Implement a focus management system: when React UI is focused, disable Phaser keyboard input; when the canvas is clicked, re-enable it
- Listen for Phaser's `gameout` event to detect when pointer focus leaves the canvas

**Warning signs:**
- WASD/arrow keys scroll the game while typing in a text input
- Clicking a React button also triggers a click on the game object underneath
- Player cannot type in chat or input fields because Phaser consumes keystrokes

**Phase to address:**
Milestone 0 (Foundation) -- the input boundary contract must be established when the overlay architecture is first created.

---

### Pitfall 3: Phaser-React Communication Becomes an Untyped Spaghetti Event Bus

**What goes wrong:**
The EventBus pattern (recommended by the official Phaser+React template) starts simple but degrades rapidly as game complexity grows. Without discipline, the event bus becomes a bag of untyped string events with no discoverability, no compile-time checking, and no way to trace data flow. In a 4X game with dozens of screens (galaxy map, system view, planet management, ship designer, tech tree, diplomacy), this quickly becomes the dominant source of bugs.

**Why it happens:**
The EventBus is essentially a global pub/sub with string keys. It is trivially easy to misspell event names, send the wrong payload shape, or forget to unsubscribe. TypeScript cannot check event names or payloads without explicit typing. The official template demonstrates a minimal EventBus with no type safety.

**How to avoid:**
- Create a strongly-typed EventBus from day one using TypeScript generics:
  ```typescript
  type GameEvents = {
    'scene-ready': { scene: Phaser.Scene };
    'planet-selected': { planetId: string; systemId: string };
    'ui-overlay-opened': { panel: string };
    'ui-overlay-closed': { panel: string };
  };

  class TypedEventBus {
    emit<K extends keyof GameEvents>(event: K, data: GameEvents[K]): void;
    on<K extends keyof GameEvents>(event: K, fn: (data: GameEvents[K]) => void): void;
    off<K extends keyof GameEvents>(event: K, fn: (data: GameEvents[K]) => void): void;
  }
  ```
- Place the event type map in `@nova-imperia/shared` so both client subsystems use the same contract
- Keep event count small: events should cross the Phaser/React boundary, not replace all function calls
- Document each event's lifecycle (who emits, who listens, when)

**Warning signs:**
- Event names defined as raw strings in multiple files
- `EventBus.emit('playerSelected', ...)` vs `EventBus.emit('player-selected', ...)` typo bugs
- Difficulty tracing which component responds to which event
- Event listeners accumulating without proper cleanup

**Phase to address:**
Milestone 0 (Foundation) -- define the typed EventBus in the shared package as part of initial architecture.

---

### Pitfall 4: Phaser Scene Lifecycle Memory Leaks

**What goes wrong:**
Switching between Phaser scenes (galaxy map to system view to combat view, etc.) leaks textures, event listeners, physics worlds, and timers unless each scene explicitly cleans up on shutdown. Over a multi-hour 4X game session, leaked GPU memory accumulates until the browser tab crashes or rendering degrades severely.

**Why it happens:**
Phaser does not automatically destroy textures loaded by a scene when that scene shuts down. Event listeners registered with `this.events.on()` persist unless explicitly removed. Phaser's `scene.shutdown` event is distinct from `scene.destroy`, and many developers only handle one. Dynamic bitmap masks leak GPU memory. The problem is invisible in short test sessions and only manifests after many scene transitions.

**How to avoid:**
- Implement a base scene class that enforces cleanup in a `shutdown` handler:
  ```typescript
  abstract class BaseScene extends Phaser.Scene {
    shutdown() {
      this.events.removeAllListeners();
      this.input.removeAllListeners();
      // Subclass cleanup hooks
      this.onCleanup();
    }
  }
  ```
- Use object pooling for frequently created/destroyed objects (particles, projectiles, UI elements)
- Track loaded textures per-scene and remove them on shutdown if not shared
- Listen to both `shutdown` and `destroy` events
- Profile memory in Chrome DevTools during development with a "scene cycling" test (switch between scenes 50 times and check heap growth)

**Warning signs:**
- Browser tab memory usage increasing steadily during gameplay
- "WebGL: CONTEXT_LOST_WEBGL" errors after extended play sessions
- GPU process memory climbing in Chrome's Task Manager
- Increasing frame time after many scene transitions

**Phase to address:**
Milestone 0 (Foundation) -- establish the BaseScene pattern. Milestone 1 (Galaxy Navigation) -- first real test with galaxy/system scene switching. Milestone 5 (Combat) -- heaviest scene with most transient objects.

---

### Pitfall 5: npm Workspaces + TypeScript + Vite Triple Import Resolution Mismatch

**What goes wrong:**
Three separate module resolution systems must agree on how to find `@nova-imperia/shared`: npm workspaces (symlinks), TypeScript compiler (project references / paths), and Vite (its own resolver). When any one disagrees, you get different failure modes: "module not found" at build time, missing types in the IDE, runtime import errors, or Vite failing to detect changes in the shared package during hot reload.

**Why it happens:**
- npm workspaces creates symlinks in `node_modules/@nova-imperia/shared` pointing to `packages/shared`
- TypeScript needs `composite: true`, `declaration: true`, and proper `references` in tsconfig to resolve across project boundaries
- Vite does not follow symlinks by default and uses its own module resolution
- The shared package's `package.json` points `main` at `./src/index.ts` (source, not compiled output), which works for development but fails in production builds

**How to avoid:**
- Use `moduleResolution: "bundler"` in tsconfig (already set -- good)
- Install `vite-tsconfig-paths` plugin so Vite reads TypeScript paths
- Set `server.watch.ignored` in Vite config to NOT ignore symlinked packages (or use `resolve.preserveSymlinks: true`)
- In the shared package.json, use the `exports` field with conditions:
  ```json
  {
    "exports": {
      ".": {
        "types": "./src/index.ts",
        "import": "./src/index.ts"
      }
    }
  }
  ```
- Verify the full chain works: save a type change in shared, confirm IDE updates, confirm Vite hot-reloads, confirm `tsc --build` succeeds

**Warning signs:**
- IDE shows types from shared package but Vite build fails
- Changes to shared package require manual rebuild or dev server restart
- "Cannot find module '@nova-imperia/shared'" errors that come and go
- `tsc --build` succeeds but `vite build` fails (or vice versa)

**Phase to address:**
Milestone 0 (Foundation) -- must be validated before any real code depends on shared types.

---

### Pitfall 6: Browser Tab Throttling Breaks Real-Time Game State

**What goes wrong:**
When a player switches to another browser tab (to check a wiki, chat on Discord, etc.), the browser throttles `requestAnimationFrame` to 0 fps and limits `setTimeout`/`setInterval` to 1 call per second or less. The Phaser game loop stops entirely. When the player returns, the game receives a massive delta-time spike and attempts to "catch up", causing game entities to teleport, timers to fire all at once, and the game state to desynchronize from the server.

**Why it happens:**
All modern browsers (Chrome, Firefox, Safari) aggressively throttle background tabs for battery/performance. `requestAnimationFrame` callbacks are paused entirely in hidden tabs. `setTimeout` gets throttled to minimum 1-second intervals (Chrome 88+). This is by design and cannot be disabled.

**How to avoid:**
- Listen to the Page Visibility API (`document.addEventListener('visibilitychange', ...)`)
- When the tab is hidden: pause the game clock, notify the server the player is inactive, stop non-essential rendering
- When the tab returns: clamp the first delta-time to a maximum (e.g., 100ms), request a full state sync from the server, show a brief "Reconnecting..." overlay
- For multiplayer: the server must treat the player as still in-game (the server is authoritative), and the client must reconcile state on return
- WebSocket connections (Socket.io) are NOT throttled in background tabs -- use this for keepalive

**Warning signs:**
- Ships or fleets teleporting after alt-tabbing
- "Time jump" when returning to the game tab
- Server detecting client as desynchronized after the player returns
- Research/construction timers completing all at once visually

**Phase to address:**
Milestone 0 (Foundation) -- implement visibility handling in the game loop wrapper. Milestone 8 (Multiplayer) -- full reconnection/state-sync protocol.

---

### Pitfall 7: Putting Game Logic in Phaser Scenes Instead of a Portable Engine Layer

**What goes wrong:**
Developers embed game rules, state management, and simulation logic directly in Phaser scene `update()` methods. This couples the game engine to the rendering framework, making it impossible to run game logic on the server (needed for authoritative multiplayer), impossible to unit test without Phaser, and impossible to reuse logic across scenes.

**Why it happens:**
Phaser tutorials universally show game logic inside scenes. The scene's `update(time, delta)` method is the obvious place to put simulation code. It works perfectly for single-player prototypes. The consequences only become apparent when you need server-side simulation (Milestone 8) or comprehensive testing (Milestone 9).

**How to avoid:**
- Architect a "headless" game engine in `@nova-imperia/shared` or a separate `@nova-imperia/engine` package from day one
- The engine handles: galaxy state, fleet movement, research progress, combat resolution, diplomacy, resource calculations
- Phaser scenes are thin rendering layers that read engine state and dispatch player commands
- The server runs the same engine without Phaser
- Scenes call `engine.update(delta)` and then render the result
- This is the exact architecture described in PROJECT.md (`packages/shared` for types, server for authoritative state)

**Warning signs:**
- Scene files growing past 200 lines
- Game state stored as Phaser GameObject properties instead of a separate data model
- Cannot run game logic in a Node.js test without importing Phaser
- Duplicate logic between client and server

**Phase to address:**
Milestone 0 (Foundation) -- establish the engine/renderer separation. Milestone 1 (Galaxy Generation) -- first real test: galaxy generation must work in shared, rendering in client.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Raw string event names in EventBus | Faster to prototype | Untraceable bugs, no autocomplete, refactoring nightmares | Never -- type the EventBus from day one, it takes 30 minutes |
| Game state stored on Phaser GameObjects | Quick to render | Cannot test without Phaser, cannot share with server, impossible to serialize for save/load | Never -- always use a separate data model |
| Skipping shared package build step | Faster dev iteration | Stale types, runtime crashes when types drift | Only in early prototyping (Milestone 0), must fix by Milestone 1 |
| `any` types at Phaser/React boundary | Avoids wrestling with Phaser's complex types | Loses all type safety at the most critical integration point | Never -- use `unknown` and validate |
| Inline Phaser config in React component | Quick to get running | Cannot configure per-environment, hard to test, duplicated if multiple entry points | Only for initial proof-of-concept, extract to config file immediately |
| Loading all game assets in a single preload scene | Simple asset pipeline | Multi-second blank screen on load, cannot show progress, wastes bandwidth on unused assets | Early milestones only (0-2). Must implement lazy/per-scene loading by Milestone 3 |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Phaser + Vite HMR | Expecting Phaser to hot-reload like React components. Phaser game instances cannot be patched; the entire game must be destroyed and recreated. | Accept full game restart on Phaser code changes. Structure code so most iteration happens in React UI (which does HMR) or in the engine layer (testable without browser). |
| Vite + npm workspaces symlinks | Vite does not watch symlinked packages for changes by default. Edits to `@nova-imperia/shared` do not trigger rebuilds. | Use `vite-tsconfig-paths` plugin. Consider a file watcher plugin or configure `server.watch` to include the shared package path explicitly. |
| TypeScript project references + Vite | Running `tsc --build` and `vite build` as independent steps that can disagree about module resolution. | Use `moduleResolution: "bundler"` in all tsconfigs. Run `tsc --noEmit` for type-checking only; let Vite handle transpilation. |
| Socket.io + Phaser game loop | Handling Socket.io messages directly in scene update(), causing frame-rate-dependent network processing. | Buffer incoming messages in a queue. Process the queue at the start of each game loop tick, decoupled from network arrival timing. |
| React state + Phaser data | Using React state (useState) to store game data that Phaser needs every frame. React re-renders on state change, causing unnecessary DOM reconciliation during gameplay. | Store game data in the engine layer (plain objects/classes). React reads from engine state only when UI needs to update (on events, not on frames). |
| PostgreSQL + game saves | Storing game state as a single massive JSON blob in one column. | Design a normalized schema from the start, or use JSONB columns with indexed paths for queryable game state. Plan the save format in the shared types package. |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Creating new objects every frame in Phaser update() | GC pauses causing frame drops, sawtooth memory pattern in profiler | Use object pooling for projectiles, particles, UI elements. Pre-allocate arrays. Avoid `new` in update loops. | 100+ objects/frame, noticeable at 500+ |
| Rendering all star systems on the galaxy map simultaneously | Frame rate drops on large galaxies, GPU memory exhaustion | Implement camera-culling: only render systems visible in the viewport. Use Phaser's camera cull feature or manual bounds checking. | 200+ star systems (the game targets complex galaxies) |
| React re-rendering the entire UI on every game state change | UI feels sluggish, React DevTools shows constant re-renders during gameplay | Memoize components (`React.memo`), use selectors for engine state, emit granular events ("planet-production-changed" not "state-changed") | Any UI with more than 10 updating data points |
| Uncompressed textures in WebGL | High VRAM usage, long load times, mobile devices run out of memory | Use compressed texture formats (Basis Universal via KTX2). Size sprite sheets to power-of-2 dimensions. | 50+ unique textures or any texture atlas > 4096x4096 |
| Running pathfinding (A* on galaxy graph) synchronously on the main thread | Game freezes during fleet movement calculations on large galaxies | Pre-compute pathfinding results, cache routes, or run pathfinding in a Web Worker | 100+ node galaxy with multiple simultaneous fleet movements |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Trusting client-submitted game commands without server validation | Players can cheat by sending fabricated commands (instant research, free resources, teleporting fleets) | Server-authoritative architecture: client sends intents, server validates against game rules and current state before applying |
| Exposing PostgreSQL connection string in client bundle | Database credentials leaked to any player who inspects the bundle | Server-only database access. Client communicates exclusively through Socket.io and REST API. Environment variables only on server. |
| No rate limiting on Socket.io game commands | Denial of service by flooding the server with commands; automated bot play | Implement per-connection rate limiting on the server. Validate command frequency against game rules (e.g., cannot issue more than N commands per second). |
| Sending full game state to all players on every tick | Information leaking: players can see fog-of-war hidden data by inspecting network traffic | Send only the data each player is entitled to see. Filter state by player visibility before transmission. |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| React UI and Phaser canvas have different visual languages (React uses system fonts/Material UI, Phaser uses pixel art/custom) | Game feels like two different products stitched together, breaking immersion | Design a unified visual language. Use the same color palette, typography, and spacing in both React overlays and Phaser scenes. Custom CSS that matches the game's dark space aesthetic. |
| React overlay blocks the game view during important moments | Player cannot see fleet movement or combat while a management dialog is open | Use semi-transparent overlays, side panels instead of modals, or allow panels to be moved/minimized. Pause the game when modal dialogs are open (single-player). |
| No keyboard shortcuts for React UI panels | Breaks the original game's design pillar of "every screen accessible via hotkeys or 2 clicks" | Design a unified keybinding system that works across both Phaser and React. Register all shortcuts in a central registry (in the shared/engine layer). |
| Loading screens with no progress indication | Players think the game has frozen during initial asset load or galaxy generation | Use Phaser's loader progress events to show a real progress bar. For procedural generation, yield periodically and update a progress indicator. |

## "Looks Done But Isn't" Checklist

- [ ] **Phaser+React bridge:** Often missing proper cleanup on unmount -- verify by enabling StrictMode and confirming no dual instances, then hot-reload 10 times and check for memory leaks
- [ ] **Shared package types:** Often compiles in IDE but fails in Vite build -- verify by running `npm run build` from repo root and confirming zero errors
- [ ] **Canvas scaling:** Often hardcoded to development resolution -- verify by resizing the browser window and confirming the game scales without layout breaks; test at 1280x720, 1920x1080, and 2560x1440
- [ ] **Event listener cleanup:** Often accumulates listeners across scene transitions -- verify by switching between scenes 20 times and checking listener count with Phaser's event system debug
- [ ] **Dev server concurrency:** Often only client or server starts, not both -- verify `npm run dev` starts Vite dev server AND Fastify server simultaneously with a single command
- [ ] **Asset paths in production:** Often work in dev (Vite serves from `/public`) but break in prod build -- verify by running `npm run build && npm run preview` and confirming all assets load
- [ ] **TypeScript strict mode:** Often disabled or partially applied -- verify `"strict": true` is set in all tsconfig files and `tsc --build` reports zero errors

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Dual Phaser instances (StrictMode) | LOW | Add ref guard to PhaserGame component, add cleanup to useEffect return. 30-minute fix. |
| Input focus conflicts | MEDIUM | Retrofit a focus management service. Requires auditing all input handlers in both Phaser and React. 1-2 day fix depending on how many scenes exist. |
| Untyped EventBus | MEDIUM-HIGH | Must find all event names by searching codebase, create type map, replace all usages. Risk of missed events. Grows with codebase size -- fix early. |
| Scene memory leaks | HIGH | Requires profiling each scene, identifying all leak sources, implementing cleanup for each. May require refactoring scene initialization patterns. Multi-day effort that grows with scene count. |
| Triple import resolution mismatch | MEDIUM | Reconfigure tsconfig, vite.config, and package.json exports. May require restructuring the shared package. 1-2 day fix but blocks all development while broken. |
| Game logic embedded in scenes | VERY HIGH | Extracting game logic from scenes into a portable engine is effectively a rewrite of the affected systems. Cost scales with how much logic was embedded. This is the most expensive mistake to fix later. |
| Tab throttling not handled | LOW-MEDIUM | Add visibility change listener, clamp delta-time, add reconnection logic. 1-day fix for single-player, 3-5 day fix for multiplayer state reconciliation. |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| React StrictMode dual instances | Milestone 0 | StrictMode enabled, single canvas in DOM, no errors on mount/unmount cycle |
| Input focus war | Milestone 0 | React text input works while game is running; game clicks do not fire through UI buttons |
| Untyped EventBus | Milestone 0 | TypeScript compiler catches misspelled event names; event payload mismatches are compile errors |
| Scene memory leaks | Milestone 0 (pattern), Milestone 1 (validation) | Memory profiler shows flat heap after 50 scene transitions |
| Import resolution mismatch | Milestone 0 | Change a type in shared, confirm IDE updates, Vite hot-reloads, and `tsc --build` passes -- all three |
| Browser tab throttling | Milestone 0 (basic), Milestone 8 (full) | Alt-tab for 30 seconds, return to game, verify no time jump or state desync |
| Game logic in scenes | Milestone 0 (architecture), Milestone 1 (enforcement) | Galaxy generation runs in a Node.js test with `import { generateGalaxy } from '@nova-imperia/shared'` -- no Phaser dependency |
| Phaser HMR expectations | Milestone 0 | Developer documentation states that Phaser changes require full reload; React UI changes hot-reload |
| React state as game data | Milestone 0 (architecture), Milestone 2 (enforcement) | No `useState` calls store game-critical data; all game state lives in the engine layer |
| Asset loading blocking | Milestone 1 (initial), Milestone 3 (per-scene loading) | Loading screen shows progress bar; game is playable within 3 seconds of page load for returning players |

## Sources

- [Official Phaser 3 + React TypeScript Template](https://github.com/phaserjs/template-react-ts) -- EventBus pattern, PhaserGame bridge component, scene registration
- [Phaser Game.destroy() throws error in React (Issue #4305)](https://github.com/phaserjs/phaser/issues/4305) -- cleanup on unmount
- [React StrictMode double-mount (Issue #24502)](https://github.com/facebook/react/issues/24502) -- why effects run twice
- [Phaser mouse input through overlay HTML (Issue #4447)](https://github.com/photonstorm/phaser/issues/4447) -- pointer events passing through DOM overlays
- [Phaser memory leak issues (Issue #5456)](https://github.com/photonstorm/phaser/issues/5456) -- texture/resource cleanup
- [3ee Games: Phaser game with React UI](https://3ee.com/blog/phaser-game-react-ui/) -- event bridge architecture, RAF separation
- [Bridging Worlds: Integrating Phaser with React](https://arokis.me/articles/react-phaser) -- bridge component patterns
- [Page Visibility API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API) -- tab throttling behavior
- [Chrome Background Tab Throttling](https://developer.chrome.com/blog/timer-throttling-in-chrome-88) -- timer limitations
- [Vite + npm workspaces symlink issue (vitejs/vite#5370)](https://github.com/vitejs/vite/issues/5370) -- shared package resolution
- [vite-tsconfig-paths plugin](https://www.npmjs.com/package/vite-tsconfig-paths) -- syncing TS paths with Vite
- [WebGL Best Practices (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices) -- GPU memory management
- [Phaser ScaleManager Documentation](https://docs.phaser.io/api-documentation/class/scale-scalemanager) -- responsive canvas handling
- [npm Circular Dependencies (Issue #19581)](https://github.com/npm/npm/issues/19581) -- monorepo dependency pitfalls

---
*Pitfalls research for: Nova Imperia -- Phaser 3 + React hybrid 4X space strategy game*
*Researched: 2026-03-21*
