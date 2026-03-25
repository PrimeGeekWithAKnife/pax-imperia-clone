# Architecture Research

**Domain:** Web-based 4X real-time space strategy game (Phaser 3 + React hybrid)
**Researched:** 2026-03-21
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BROWSER (Client)                             │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                   React UI Layer (DOM)                        │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐    │   │
│  │  │ HUD      │ │ Menus    │ │ Dialogs  │ │ Management   │    │   │
│  │  │ Overlay  │ │ (Main,   │ │ (Ship    │ │ Screens      │    │   │
│  │  │ (resources│ │ Pause,  │ │ Design,  │ │ (Planet,     │    │   │
│  │  │ minimap) │ │ Settings)│ │ Diplo)   │ │ Research)    │    │   │
│  │  └─────┬────┘ └────┬─────┘ └────┬─────┘ └──────┬───────┘    │   │
│  │        │            │            │              │            │   │
│  │  ══════╪════════════╪════════════╪══════════════╪═══════     │   │
│  │        │       EventBus (pub/sub bridge)        │            │   │
│  │  ══════╪════════════╪════════════╪══════════════╪═══════     │   │
│  │        │            │            │              │            │   │
│  └────────┼────────────┼────────────┼──────────────┼────────────┘   │
│           │            │            │              │                │
│  ┌────────┼────────────┼────────────┼──────────────┼────────────┐   │
│  │        ▼            ▼            ▼              ▼            │   │
│  │                Phaser 3 Game Layer (Canvas/WebGL)             │   │
│  │                                                              │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │   │
│  │  │ Boot     │ │ Galaxy   │ │ System   │ │ Combat   │       │   │
│  │  │ Scene    │ │ Map      │ │ View     │ │ Scene    │       │   │
│  │  │          │ │ Scene    │ │ Scene    │ │          │       │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │   │
│  │       │                                                     │   │
│  │  ┌────┴────────────────────────────────────────────────┐    │   │
│  │  │              Game State Store (client)               │    │   │
│  │  │   Galaxy data, fleets, empires, fog-of-war, etc.    │    │   │
│  │  └──────────────────────┬──────────────────────────────┘    │   │
│  │                         │                                   │   │
│  └─────────────────────────┼───────────────────────────────────┘   │
│                            │                                       │
│  ┌─────────────────────────┼───────────────────────────────────┐   │
│  │              Network Layer (Socket.io client)               │   │
│  │   Commands OUT ─────►   │   ◄───── State Updates IN        │   │
│  └─────────────────────────┼───────────────────────────────────┘   │
└────────────────────────────┼───────────────────────────────────────┘
                             │ WebSocket / HTTP
┌────────────────────────────┼───────────────────────────────────────┐
│                        SERVER (Node.js)                            │
│                            │                                       │
│  ┌─────────────────────────┼───────────────────────────────────┐   │
│  │              Network Layer (Socket.io + Fastify)            │   │
│  │   ◄── Commands IN       │       State Updates OUT ──►      │   │
│  └─────────────────────────┼───────────────────────────────────┘   │
│                            │                                       │
│  ┌─────────────────────────┼───────────────────────────────────┐   │
│  │            Authoritative Game State (server)                │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │   │
│  │  │ Game     │ │ Galaxy   │ │ Combat   │ │ Diplomacy│      │   │
│  │  │ Loop     │ │ Manager  │ │ Resolver │ │ Manager  │      │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                    │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                   Persistence Layer                          │   │
│  │  ┌──────────────┐  ┌──────────────┐                         │   │
│  │  │ PostgreSQL   │  │ Redis        │                         │   │
│  │  │ (accounts,   │  │ (sessions,   │                         │   │
│  │  │  saved games)│  │  pub/sub)    │                         │   │
│  │  └──────────────┘  └──────────────┘                         │   │
│  └─────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| React UI Layer | All DOM-based UI: menus, HUD, dialogs, management screens | React components rendered in a DOM container positioned absolutely over the Phaser canvas via CSS `pointer-events: none` (with `pointer-events: auto` on interactive elements) |
| EventBus | Bidirectional communication bridge between React and Phaser | Simple pub/sub emitter (Phaser.Events.EventEmitter or mitt); both layers emit and subscribe |
| PhaserGame Bridge | React component that initializes Phaser and exposes game/scene refs | `forwardRef` component wrapping `new Phaser.Game(config)`, tracks active scene |
| Phaser Scenes | Game rendering: galaxy map, star system orbital view, combat | Self-contained Phaser.Scene subclasses with own cameras, input, display lists |
| Client Game State | Single source of truth for client-side game data | Plain TypeScript store (or Zustand) holding galaxy, fleets, empires; both React and Phaser read from it |
| Network Layer (client) | Sends player commands, receives server state updates | Socket.io client wrapper with typed event definitions from shared package |
| Network Layer (server) | Receives commands, broadcasts state deltas | Fastify + Socket.io server with room management per game session |
| Authoritative Game State | Server-side game simulation, validates all actions | Game loop running on server tick; managers for galaxy, combat, diplomacy, economy |
| Persistence Layer | Long-term storage for accounts, saved games, leaderboards | PostgreSQL via connection pool; Redis for sessions and real-time pub/sub |

## Recommended Project Structure

```
packages/
├── client/                       # Phaser 3 + React game client
│   ├── src/
│   │   ├── main.tsx              # React entry point (renders App)
│   │   ├── App.tsx               # Root React component, mounts PhaserGame
│   │   ├── PhaserGame.tsx        # Bridge component (forwardRef, game init)
│   │   │
│   │   ├── game/                 # Everything Phaser
│   │   │   ├── config.ts         # Phaser.Types.Core.GameConfig
│   │   │   ├── EventBus.ts       # Shared event emitter (bridge)
│   │   │   ├── scenes/           # Phaser scenes
│   │   │   │   ├── BootScene.ts  # Asset preloading, splash
│   │   │   │   ├── GalaxyScene.ts# Galaxy map (pan/zoom, wormholes)
│   │   │   │   ├── SystemScene.ts# Star system orbital view
│   │   │   │   └── CombatScene.ts# Tactical combat
│   │   │   ├── objects/          # Phaser GameObjects (sprites, groups)
│   │   │   │   ├── StarNode.ts   # Star on galaxy map
│   │   │   │   ├── PlanetOrb.ts  # Planet in system view
│   │   │   │   ├── FleetIcon.ts  # Fleet marker
│   │   │   │   └── ShipSprite.ts # Ship in combat
│   │   │   └── systems/          # Game logic running in Phaser update loop
│   │   │       ├── CameraController.ts
│   │   │       └── SelectionManager.ts
│   │   │
│   │   ├── ui/                   # Everything React
│   │   │   ├── components/       # Reusable UI components
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Panel.tsx
│   │   │   │   ├── ResourceBar.tsx
│   │   │   │   └── Tooltip.tsx
│   │   │   ├── overlays/         # Scene-specific UI overlays
│   │   │   │   ├── GalaxyHUD.tsx # Minimap, system info, fleet list
│   │   │   │   ├── SystemHUD.tsx # Planet details, build queues
│   │   │   │   ├── CombatHUD.tsx # Ship status, target info
│   │   │   │   └── MainMenu.tsx  # Title screen, new game, load
│   │   │   ├── screens/          # Full-screen management UIs
│   │   │   │   ├── PlanetScreen.tsx
│   │   │   │   ├── ResearchScreen.tsx
│   │   │   │   ├── ShipDesigner.tsx
│   │   │   │   ├── DiplomacyScreen.tsx
│   │   │   │   └── FleetManager.tsx
│   │   │   └── hooks/            # React hooks for game integration
│   │   │       ├── useGameEvent.ts   # Subscribe to EventBus from React
│   │   │       ├── useGameState.ts   # Read from client game state
│   │   │       └── useActiveScene.ts # Track current Phaser scene
│   │   │
│   │   ├── state/                # Client-side game state store
│   │   │   ├── GameStore.ts      # Central state (Zustand or plain TS)
│   │   │   ├── selectors.ts      # Derived data helpers
│   │   │   └── actions.ts        # State mutations
│   │   │
│   │   ├── network/              # Socket.io client wrapper
│   │   │   ├── SocketClient.ts   # Connection, reconnection, typed events
│   │   │   ├── commands.ts       # Outbound command builders
│   │   │   └── handlers.ts       # Inbound state update processors
│   │   │
│   │   └── assets/               # Static game assets
│   │       ├── sprites/
│   │       ├── audio/
│   │       └── fonts/
│   │
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json
│
├── server/                       # Game server
│   ├── src/
│   │   ├── main.ts               # Fastify + Socket.io bootstrap
│   │   ├── game/                 # Authoritative game logic
│   │   │   ├── GameLoop.ts       # Fixed-tick server game loop
│   │   │   ├── GameSession.ts    # One game instance (room)
│   │   │   ├── GalaxyManager.ts  # Galaxy generation, pathfinding
│   │   │   ├── EmpireManager.ts  # Empire state, resources, colonies
│   │   │   ├── FleetManager.ts   # Fleet movement, orders
│   │   │   ├── CombatResolver.ts # Combat simulation
│   │   │   ├── ResearchManager.ts# Tech tree progression
│   │   │   └── DiplomacyManager.ts
│   │   ├── network/              # Socket.io server
│   │   │   ├── SocketServer.ts   # Room management, event routing
│   │   │   ├── handlers/         # Per-command handlers
│   │   │   └── middleware/       # Auth, rate limiting
│   │   ├── api/                  # REST endpoints (Fastify)
│   │   │   ├── auth.ts           # Login, register, sessions
│   │   │   ├── lobbies.ts        # Game lobby CRUD
│   │   │   └── leaderboards.ts
│   │   ├── db/                   # PostgreSQL
│   │   │   ├── pool.ts           # Connection pool
│   │   │   ├── models/           # Query builders per entity
│   │   │   └── migrations/       # Schema migrations
│   │   └── ai/                   # Computer player (later milestones)
│   │       └── AIPlayer.ts
│   ├── tsconfig.json
│   └── package.json
│
└── shared/                       # Shared types and data
    ├── src/
    │   ├── types/                # TypeScript interfaces
    │   │   ├── galaxy.ts         # StarSystem, Planet, Galaxy
    │   │   ├── species.ts        # Species, Traits
    │   │   ├── ships.ts          # ShipDesign, Fleet, Weapon
    │   │   ├── research.ts       # TechNode, TechTree
    │   │   ├── events.ts         # Socket event type maps (critical)
    │   │   └── commands.ts       # Player command types
    │   ├── constants/            # Balance values, enums
    │   │   ├── gameBalance.ts
    │   │   └── starTypes.ts
    │   ├── data/                 # JSON data files (moddable)
    │   │   ├── techTree.json
    │   │   ├── races.json
    │   │   └── shipHulls.json
    │   └── utils/                # Shared utility functions
    │       ├── pathfinding.ts    # A* on galaxy graph
    │       └── math.ts
    ├── tsconfig.json
    └── package.json
```

### Structure Rationale

- **`client/src/game/` vs `client/src/ui/`:** The hard boundary between Phaser code and React code is the single most important structural decision. Phaser scenes live under `game/`, React components live under `ui/`. They communicate exclusively through the EventBus and the shared GameStore. Neither directly imports from the other's directory.
- **`client/src/state/`:** A single client-side state store that both Phaser scenes and React components read from. This prevents the game state from becoming split between two rendering systems. When the server sends a state update, it goes into this store, and both layers react to it.
- **`client/src/network/`:** Isolated network layer with typed events (from `shared/types/events.ts`). The network layer writes into the state store; it never directly pokes Phaser scenes or React components.
- **`shared/types/events.ts`:** Typed Socket.io event maps are the contract between client and server. Defining them once in the shared package prevents desync between what the server sends and what the client expects.
- **`server/src/game/`:** Server-side game logic is completely independent of any rendering. It shares types with the client but has no dependency on Phaser or React. This enables headless testing and future dedicated server deployment.

## Architectural Patterns

### Pattern 1: EventBus Bridge (React <-> Phaser Communication)

**What:** A lightweight publish-subscribe event emitter that both the React layer and Phaser scenes import and use to communicate. This is the official Phaser-recommended pattern.

**When to use:** Every time React needs to know about a Phaser event (scene change, object selection, game tick data) or Phaser needs to respond to a React action (button click, setting change, command issued).

**Trade-offs:**
- PRO: Complete decoupling; neither layer needs to know about the other's internals
- PRO: Easy to test each layer independently
- CON: Event-based communication can become hard to trace in large codebases
- CON: No type safety unless you explicitly type the event map

**Example:**
```typescript
// game/EventBus.ts
import Phaser from 'phaser';

export const EventBus = new Phaser.Events.EventEmitter();

// Type the events for safety
export interface GameEvents {
  'scene-ready': [scene: Phaser.Scene];
  'star-selected': [systemId: string];
  'fleet-moved': [fleetId: string, targetId: string];
  'open-planet-screen': [planetId: string];
  'close-overlay': [];
}

// Typed emit helper
export function emitGameEvent<K extends keyof GameEvents>(
  event: K,
  ...args: GameEvents[K]
): void {
  EventBus.emit(event, ...args);
}
```

```typescript
// In a Phaser scene (game/scenes/GalaxyScene.ts)
import { emitGameEvent } from '../EventBus';

export class GalaxyScene extends Phaser.Scene {
  create() {
    // When player clicks a star, tell React
    this.input.on('gameobjectup', (pointer, star: StarNode) => {
      emitGameEvent('star-selected', star.systemId);
    });
    emitGameEvent('scene-ready', this);
  }
}
```

```typescript
// In a React component (ui/overlays/GalaxyHUD.tsx)
import { EventBus } from '../../game/EventBus';

function GalaxyHUD() {
  const [selectedSystem, setSelectedSystem] = useState<string | null>(null);

  useEffect(() => {
    const handler = (systemId: string) => setSelectedSystem(systemId);
    EventBus.on('star-selected', handler);
    return () => { EventBus.off('star-selected', handler); };
  }, []);

  return selectedSystem ? <SystemInfoPanel systemId={selectedSystem} /> : null;
}
```

### Pattern 2: PhaserGame Bridge Component

**What:** A React component that owns the Phaser.Game instance, initializes it into a DOM container, and exposes the game reference and active scene to the React tree via `forwardRef`.

**When to use:** At application startup. This is the root integration point. The entire React app wraps around this component.

**Trade-offs:**
- PRO: Clean lifecycle management -- React controls when Phaser starts and stops
- PRO: React can access the game instance for debug tooling, screenshots, resize handling
- CON: Tight coupling at the root level (but this is intentional and minimal)

**Example:**
```typescript
// PhaserGame.tsx
import { forwardRef, useEffect, useLayoutEffect, useRef } from 'react';
import Phaser from 'phaser';
import { EventBus } from './game/EventBus';
import { gameConfig } from './game/config';

export interface IRefPhaserGame {
  game: Phaser.Game | null;
  scene: Phaser.Scene | null;
}

interface Props {
  onSceneReady?: (scene: Phaser.Scene) => void;
}

export const PhaserGame = forwardRef<IRefPhaserGame, Props>(
  function PhaserGame({ onSceneReady }, ref) {
    const gameRef = useRef<Phaser.Game | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
      if (gameRef.current) return;

      gameRef.current = new Phaser.Game({
        ...gameConfig,
        parent: containerRef.current!,
      });

      if (typeof ref === 'function') {
        ref({ game: gameRef.current, scene: null });
      } else if (ref) {
        ref.current = { game: gameRef.current, scene: null };
      }

      return () => {
        gameRef.current?.destroy(true);
        gameRef.current = null;
      };
    }, []);

    useEffect(() => {
      const handler = (scene: Phaser.Scene) => {
        if (typeof ref === 'function') {
          ref({ game: gameRef.current, scene });
        } else if (ref) {
          ref.current = { game: gameRef.current, scene };
        }
        onSceneReady?.(scene);
      };

      EventBus.on('scene-ready', handler);
      return () => { EventBus.off('scene-ready', handler); };
    }, [ref, onSceneReady]);

    return <div ref={containerRef} id="phaser-container" />;
  }
);
```

### Pattern 3: Shared Game State Store (Single Source of Truth)

**What:** A client-side state store that holds the current game state. Both Phaser scenes and React components read from it. Only the network layer and local commands write to it.

**When to use:** For any data that both Phaser and React need access to: selected empire resources, fleet positions, planet data, fog-of-war state. This replaces the anti-pattern of duplicating state between the two rendering layers.

**Trade-offs:**
- PRO: Eliminates state sync bugs between React and Phaser
- PRO: React components can use hooks to subscribe; Phaser scenes poll in update()
- CON: Adds an abstraction layer between network and rendering
- CON: Phaser's update loop polling is less elegant than React's reactive subscriptions (acceptable trade-off)

**Example:**
```typescript
// state/GameStore.ts
import { create } from 'zustand';
import type { Galaxy, Empire, Fleet } from '@nova-imperia/shared';

interface GameState {
  galaxy: Galaxy | null;
  empires: Map<string, Empire>;
  fleets: Fleet[];
  selectedSystemId: string | null;
  gameSpeed: number;

  // Actions
  setGalaxy: (galaxy: Galaxy) => void;
  updateFleet: (fleet: Fleet) => void;
  selectSystem: (id: string | null) => void;
  setGameSpeed: (speed: number) => void;
}

export const useGameStore = create<GameState>((set) => ({
  galaxy: null,
  empires: new Map(),
  fleets: [],
  selectedSystemId: null,
  gameSpeed: 1,

  setGalaxy: (galaxy) => set({ galaxy }),
  updateFleet: (fleet) => set((state) => ({
    fleets: state.fleets.map(f => f.id === fleet.id ? fleet : f),
  })),
  selectSystem: (id) => set({ selectedSystemId: id }),
  setGameSpeed: (speed) => set({ gameSpeed: speed }),
}));
```

```typescript
// Phaser scene reads from store (polling in update loop)
export class GalaxyScene extends Phaser.Scene {
  update() {
    const { fleets, galaxy } = useGameStore.getState();
    // Update fleet positions on map based on current state
    this.updateFleetPositions(fleets);
  }
}
```

```typescript
// React component reads from store (reactive subscription)
function ResourceBar() {
  const empire = useGameStore(
    (state) => state.empires.get(state.localPlayerId)
  );
  return <div>Credits: {empire?.credits ?? 0}</div>;
}
```

### Pattern 4: Command/Update Network Protocol

**What:** The client sends typed "commands" (player intent) to the server, and the server sends back "updates" (state deltas). Commands are never trusted; the server validates everything.

**When to use:** All multiplayer interactions. Even in single-player, this pattern should be followed so multiplayer works without architecture changes later.

**Trade-offs:**
- PRO: Server-authoritative prevents cheating
- PRO: Same architecture works for single-player (server runs locally or in-process)
- PRO: Commands are small (intent, not state), reducing bandwidth
- CON: Added latency for all actions (mitigated with optimistic updates for non-critical actions)

**Example:**
```typescript
// shared/types/commands.ts
export type GameCommand =
  | { type: 'move-fleet'; fleetId: string; targetSystemId: string }
  | { type: 'build-ship'; planetId: string; designId: string }
  | { type: 'set-research'; empireId: string; techId: string }
  | { type: 'colonize'; fleetId: string; planetId: string };

// shared/types/events.ts
export interface ServerToClientEvents {
  'state-update': (delta: GameStateDelta) => void;
  'combat-started': (combat: CombatInitData) => void;
  'game-over': (results: GameResults) => void;
}

export interface ClientToServerEvents {
  'command': (cmd: GameCommand) => void;
  'request-state': () => void;
}
```

## Data Flow

### Primary Game Loop Data Flow

```
[Player clicks star in Phaser canvas]
    |
    v
[GalaxyScene] ──emits──> [EventBus: 'star-selected']
    |                           |
    |                           v
    |                     [React GalaxyHUD updates]
    |                     [Shows system info panel]
    |
    v
[Player clicks "Send Fleet" button in React UI]
    |
    v
[React component] ──calls──> [SocketClient.sendCommand({
                                type: 'move-fleet',
                                fleetId, targetSystemId
                              })]
    |
    v (WebSocket)
    |
[Server: SocketServer receives command]
    |
    v
[Server: FleetManager.processMove()]
    ├── Validates: Does player own fleet? Is path valid?
    ├── Calculates: Travel time via wormhole A*
    └── Updates: Authoritative game state
    |
    v
[Server: broadcasts 'state-update' delta to all clients in room]
    |
    v (WebSocket)
    |
[Client: Network handler receives delta]
    |
    v
[Client: GameStore.updateFleet(newFleetState)]
    |
    ├──> [React: useGameStore hook triggers re-render]
    |    [FleetList component shows updated position]
    |
    └──> [Phaser: GalaxyScene.update() reads new fleet position]
         [FleetIcon sprite animates to new location]
```

### Scene Transition Flow

```
[Player double-clicks star system in GalaxyScene]
    |
    v
[GalaxyScene] ──emits──> [EventBus: 'enter-system', systemId]
    |
    v
[PhaserGame bridge] ──calls──> scene.switch('SystemScene', { systemId })
    |
    ├── GalaxyScene sleeps (state preserved, no rendering)
    └── SystemScene starts (receives systemId via init data)
    |
    v
[SystemScene.create()] ──emits──> [EventBus: 'scene-ready', this]
    |
    v
[React App] receives scene change
    ├── Unmounts GalaxyHUD
    └── Mounts SystemHUD (planet list, orbital view controls)
```

### Key Data Flows

1. **Phaser -> React (game events):** Phaser scene emits to EventBus, React hooks subscribe. Used for: object selection, scene transitions, hover tooltips, combat events.

2. **React -> Phaser (UI commands):** React calls EventBus.emit() or directly calls scene methods via the PhaserGame ref. Used for: camera controls, speed changes, debug commands.

3. **React -> Server (player commands):** React UI actions create typed commands sent via Socket.io. Used for: fleet orders, build queues, research selection, diplomacy actions.

4. **Server -> Client (state updates):** Server broadcasts state deltas via Socket.io. Network handler writes to GameStore. Both React and Phaser react to the store change. Used for: all game state synchronization.

5. **Shared types enforce contracts:** `@nova-imperia/shared` package defines all interfaces used by both client and server. Changing a type in shared causes compile errors in both packages if they fall out of sync.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1 player (dev/single-player) | Server runs in same Node process or as local subprocess. No network latency. GameStore can be populated directly from game logic without Socket.io. |
| 2-8 players (typical match) | One game session per Socket.io room. Server tick rate of 5-10 Hz is sufficient for 4X (not an FPS). State deltas are small (fleet positions, resource changes). PostgreSQL handles save/load. |
| 10-50 concurrent games | Single Node.js server handles this easily. Each GameSession is an isolated instance. Redis useful for session management across potential future horizontal scaling. |
| 100+ concurrent games | Spin up multiple server instances behind a load balancer. Redis pub/sub for cross-instance communication. Sticky sessions route players to the correct server. |

### Scaling Priorities

1. **First bottleneck: Game tick computation.** A complex galaxy with 100+ star systems and multiple AI empires running full economy/research/fleet simulations will hit CPU limits on the server tick. Solution: Profile early, optimize hot paths (pathfinding, combat resolution), consider Web Workers for AI computation.

2. **Second bottleneck: State delta size.** As the galaxy grows, naive "send everything" updates become expensive. Solution: Fog-of-war filtering on the server (only send visible state to each player), delta compression (only send what changed since last update), and topic-based subscriptions (player subscribed to systems they are viewing).

## Anti-Patterns

### Anti-Pattern 1: React Managing Game Loop State

**What people do:** Store game entity positions, health, animation states in React useState/useReducer and try to drive Phaser rendering from React state changes.

**Why it's wrong:** React's reconciliation cycle runs at 60fps max but is not synchronized with Phaser's game loop. State updates trigger re-renders which create garbage collection pressure. Phaser has its own highly optimized rendering pipeline; duplicating entity tracking in React's VDOM is wasteful and causes visual stuttering.

**Do this instead:** Let Phaser own all entity rendering state. React only needs derived/summary data (resource totals, fleet counts, build queue contents) -- not per-frame positions. Use the GameStore for shared data and the EventBus for events.

### Anti-Pattern 2: Direct Cross-Layer Imports

**What people do:** Import Phaser scene classes directly into React components, or import React components into Phaser scenes, creating circular dependencies.

**Why it's wrong:** Tight coupling means you cannot test either layer independently. Changes to Phaser scene internals break React components. The two rendering systems have fundamentally different lifecycles (React is declarative/reactive, Phaser is imperative/frame-based).

**Do this instead:** Communicate exclusively through the EventBus and GameStore. The `game/` directory and the `ui/` directory should never import from each other. The bridge happens at exactly two points: PhaserGame.tsx (React owns Phaser lifecycle) and EventBus.ts (shared communication channel).

### Anti-Pattern 3: Phaser Rendering UI Elements

**What people do:** Build menus, dialogs, text input fields, scrollable lists, and data tables as Phaser GameObjects using BitmapText, Containers, and custom input handling.

**Why it's wrong:** Phaser is a game rendering engine, not a UI toolkit. It lacks: text input fields, scrollbars, accessibility (screen readers), CSS styling, responsive layout, i18n support, and form handling. Building these from scratch in Phaser takes 10x longer than using React, and the result is worse.

**Do this instead:** Use React for all UI that would be a DOM element in a normal web app. Use Phaser only for: the game world rendering (maps, sprites, particles, animations) and in-world indicators (health bars over units, selection circles, path lines). The CSS overlay approach (React DOM positioned over Phaser canvas) is the standard pattern used by the official Phaser template.

### Anti-Pattern 4: Client-Authoritative Game State

**What people do:** Process game logic entirely on the client and only sync results to the server, trusting the client's calculations.

**Why it's wrong:** Any player can modify client-side JavaScript. If the client decides combat outcomes, resource production, or fleet movement validation, cheating is trivial. Even in a "trusted" environment, desync between clients is inevitable without a single authoritative source.

**Do this instead:** Server validates all commands and runs the authoritative simulation. The client sends commands (intent), never state changes. The client may run optimistic predictions for responsiveness, but the server's state always wins on conflict.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| PostgreSQL | Connection pool via `pg` (node-postgres) | Use parameterized queries. Pool size 10-20 for dev. Migrations with `postgres-migrations` or similar. |
| Redis | `ioredis` client | Sessions, pub/sub for multi-server. Not needed in Milestone 0; add when multiplayer lands. |
| Socket.io | `fastify-socket.io` plugin | Registers Socket.io on the Fastify server instance. Typed events via shared package. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| React UI <-> Phaser Scenes | EventBus (pub/sub) | Never direct imports. Events are typed via GameEvents interface. |
| React UI <-> Client Game State | Zustand hooks (reactive) | React subscribes to store slices. Fine-grained selectors prevent unnecessary re-renders. |
| Phaser Scenes <-> Client Game State | Direct getState() calls in update() | Phaser polls the store each frame. No subscription mechanism needed -- the game loop is already running. |
| Client <-> Server | Socket.io typed events | Commands (client->server) and state deltas (server->client). Defined in shared/types/events.ts. |
| Server Game Logic <-> Database | Repository pattern | Game managers call repository functions. No direct SQL in game logic. Enables easy testing with mock repos. |
| Client <-> Shared Package | npm workspace dependency | `@nova-imperia/shared` is a workspace dependency. Types are compile-time only (zero runtime cost). |
| Server <-> Shared Package | npm workspace dependency | Same shared types. Changing a type breaks compilation on both sides immediately (this is a feature). |

## Build Order Dependencies (Milestone 0 Implications)

The architecture has clear dependency chains that dictate build order:

```
Phase 1: Shared Package (no dependencies)
    └── Types, constants, utility functions compile independently
    └── MUST be built first because both client and server depend on it

Phase 2: Phaser Bootstrap (depends on shared)
    └── Phaser.Game config, BootScene, one working scene
    └── Verify canvas renders in browser
    └── No React yet -- pure Phaser

Phase 3: React Shell + Bridge (depends on Phase 2)
    └── React entry point (main.tsx, App.tsx)
    └── PhaserGame bridge component
    └── EventBus implementation
    └── Verify React mounts AND Phaser renders within it

Phase 4: React Overlay Proof (depends on Phase 3)
    └── One React HUD component overlaying the Phaser canvas
    └── Bidirectional EventBus communication working
    └── THIS IS THE KEY MILESTONE 0 DELIVERABLE

Phase 5: Server Bootstrap (depends on shared, independent of client)
    └── Fastify HTTP server running
    └── Socket.io attached
    └── Basic health-check endpoint
    └── Can be built in parallel with Phases 2-4

Phase 6: Client-Server Connection (depends on Phase 4 + Phase 5)
    └── Socket.io client connects to server
    └── Typed events flowing both directions
    └── Foundation for all future game logic
```

**Critical path:** Phases 1 -> 2 -> 3 -> 4 prove the hybrid rendering architecture. If Phase 4 fails (React cannot reliably overlay Phaser), the entire project premise needs revisiting. Phase 5 can be built in parallel.

## Sources

- [Official Phaser 3 + React TypeScript Template (phaserjs/template-react-ts)](https://github.com/phaserjs/template-react-ts) -- HIGH confidence, official Phaser Studio template
- [Phaser Scene Concepts Documentation](https://docs.phaser.io/phaser/concepts/scenes) -- HIGH confidence, official docs
- [3ee Games: Phaser Game with React UI](https://3ee.com/blog/phaser-game-react-ui/) -- MEDIUM confidence, detailed practitioner blog
- [phaser-react-ui Library (neki-dev)](https://github.com/neki-dev/phaser-react-ui) -- MEDIUM confidence, reference implementation of interface overlay pattern
- [Phaser 3 + ECS + React (Ourcade)](https://blog.ourcade.co/posts/2023/building-phaser-3-ecs-game-with-reactjs/) -- MEDIUM confidence, ECS integration patterns
- [Dependency Injection in Phaser 3 (DEV)](https://dev.to/belka/the-power-of-dependency-injection-in-phaser-3-building-a-modular-game-with-solid-principles-5251) -- MEDIUM confidence, modularity patterns
- [Client-Server Game Architecture (Gabriel Gambetta)](https://www.gabrielgambetta.com/client-server-game-architecture.html) -- HIGH confidence, canonical reference
- [fastify-socket.io Plugin](https://github.com/ducktors/fastify-socket.io) -- HIGH confidence, official Fastify ecosystem
- [Socket.IO TypeScript Documentation](https://socket.io/docs/v4/typescript/) -- HIGH confidence, official docs

---
*Architecture research for: Nova Imperia (Phaser 3 + React hybrid 4X strategy game)*
*Researched: 2026-03-21*
