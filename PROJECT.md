# Ex Nihilo - Game Design Document

## Project: **Ex Nihilo**

A modern real-time 4X space strategy game inspired by classic games of the genre, originally developed by Heliotrope Studios and published by THQ.

---

## Original Game Research Summary

### History
- **Original**: Pax Imperia (1992) - Mac-only, by Changeling Software (Andrew & Peter Sispoidis)
- **Sequel**: Pax Imperia: Eminent Domain (1997) - PC/Mac
- **Development**: Originally announced as Pax Imperia 2 under Blizzard Entertainment (1995). Blizzard dropped it in 1996 (conflict with StarCraft) and sold rights to THQ. Heliotrope Studios completed development.
- **Reception**: Mixed reviews - GameSpot 6.5/10, GOG users 4.1/5, Alchetron 7.4/10

### What Made It Special
1. **Real-time 4X** - Unusual for the genre; no turns at all, with adjustable game speed
2. **Wormhole-connected star systems** - Not a single large map, but a web of star systems connected by jump points
3. **Deep species customization** - Players could extensively customize their race's traits, focus areas, and special abilities
4. **Streamlined interface** - The standout feature; every screen accessible via hotkeys or 2 clicks
5. **Ship design system** - Quick and painless compared to competitors like MOO2, with weapon placement mattering
6. **300+ technologies** to research
7. **Multiplayer** via TCP/IP, LAN, modem, IPX/SPX

### Original Core Systems
| System | Description |
|--------|-------------|
| **Galaxy Map** | Star systems in a wormhole/jump-point web. Color-coded by faction ownership |
| **Species/Races** | 8 pre-built + full custom creator. Traits: construction, reproduction, research, espionage, economy. Special: psychic, aquatic |
| **Colonization** | Planets have atmosphere types, gravity, natural resources. Suitability rated per-species |
| **Research** | 300+ technologies across multiple categories (weapons, shields, propulsion, biology, construction) |
| **Ship Design** | Scouts, Destroyers, Transports, Cruisers, Carriers, Battleships. Weapon placement, shields, drives, repair drones |
| **Combat** | Real-time tactical. Targeted system damage (engines, weapons, drives). Orbital defenses, planetary bombardment, fighter pods |
| **Diplomacy** | Treaties, espionage (criticized as too basic in original) |
| **Planet Management** | Specialize planets for research, finance, or construction. Population growth tied to planet color/type |
| **Victory** | Primarily conquest-based (eliminate all opponents). Score system: Economic, Military, Technological, Exploration |

### Pre-built Races (Original)
| Race | Type | Notable Trait |
|------|------|---------------|
| Solian | Human variant | Balanced |
| Terran | Human variant | Adaptable |
| Gissian | Human variant | Diplomatic |
| Kar'Tsoran | Insectoid | Merchants |
| Kybus | Insectoid | Warriors |
| Gorak | Amphibious | Hardy colonizers |
| Yssla | Reptilian | Aggressive |
| Tekari | Furry/mammalian | Researchers |
| Schreki | Nomadic | Explorers |
| D'Naren | Cybernetic | Technologists |

### Technology Ages (Original)
1. **Diamond Age** - Basic exploration, starting techs
2. **Spatial Dark Age** - +1 combat bonuses, expanded capabilities
3. **Neo Renaissance** - +2 bonuses, unlocks Cruisers
4. **Fusion Age** - +3 bonuses, unlocks Carriers
5. **Age of Star Empires** - +4 bonuses, unlocks Battleships

### Original Strengths (to preserve)
- Excellent, streamlined interface with keyboard shortcuts
- Real-time with speed control (pause/slow/fast)
- Ship design that's accessible but deep
- Wormhole-based galaxy topology (strategic chokepoints)
- Species customization depth
- Moody soundtrack and dark space atmosphere

### Original Weaknesses (to improve)
- Diplomacy too basic; alien races felt "pale and lifeless"
- No face-to-face meetings with alien leaders
- Planet suitability shown with simplistic smiley faces instead of detailed data
- Research and espionage systems lacked depth
- AI "obviously cheated in some circumstances"
- Dark graphics made game feel dull
- Victory conditions poorly documented
- Some features cut due to rushed development timeline

---

## Modern Vision: What Ex Nihilo Will Be

### Design Pillars
1. **Faithful Core** - Preserve the real-time 4X formula with wormhole galaxy topology
2. **Deeper Diplomacy** - Rich alien personalities, face-to-face negotiations, trade agreements, alliances
3. **Modern UI/UX** - Clean, information-dense interface that respects the player's intelligence
4. **Atmospheric** - Dark space aesthetic but with modern visual fidelity and particle effects
5. **Accessible Complexity** - Easy to learn, deep to master
6. **Multiplayer-First** - Built for modern online play from day one

### Key Improvements Over Original
- **Rich Diplomacy System**: Alien leaders with personalities, relationship tracking, complex treaties
- **Detailed Planet Data**: Full atmospheric/geological data instead of smiley faces
- **Deeper Research Tree**: Branching paths with meaningful choices and trade-offs
- **Improved AI**: No cheating; competent strategic and tactical decision-making
- **Modern Combat Visualization**: Real-time tactical battles with clear feedback
- **Multiple Victory Conditions**: Conquest, Diplomatic, Technological, Economic, Score
- **Modding Support**: Exposed data files for community content

---

## Technology Stack

### Frontend (Game Client)
| Technology | Purpose | Rationale |
|-----------|---------|-----------|
| **TypeScript** | Primary language | Type safety for complex game logic |
| **Phaser 3** | Game engine / rendering | Mature 2D game framework with WebGL, great for strategy games |
| **React** | UI overlays | For menus, dialogs, management screens (HUD layer over Phaser canvas) |
| **Vite** | Build tool | Fast HMR for development |
| **Howler.js** | Audio | Spatial audio, music management |

### Backend (Game Server)
| Technology | Purpose | Rationale |
|-----------|---------|-----------|
| **Node.js** | Runtime | Shared language with frontend; event-driven for real-time |
| **TypeScript** | Language | Shared types between client and server |
| **Fastify** | HTTP server | High performance REST API |
| **Socket.io** | Real-time comms | WebSocket-based multiplayer sync |
| **PostgreSQL** | Database | Player accounts, saved games, leaderboards |
| **Redis** | Caching/Pub-Sub | Game state sync, matchmaking, session management |

### Shared
| Technology | Purpose |
|-----------|---------|
| **Shared TypeScript types** | Game entities, protocols, constants |
| **JSON data files** | Tech trees, ship specs, race definitions (moddable) |
| **Zod** | Runtime validation of game data |

### DevOps
| Technology | Purpose |
|-----------|---------|
| **GitHub Actions** | CI/CD |
| **Docker** | Containerized deployment |
| **Vitest** | Unit/integration testing |
| **Playwright** | E2E testing |
| **ESLint + Prettier** | Code quality |

### Why Web-Based?
1. **Zero installation** - Play in any modern browser
2. **Cross-platform** - Windows, Mac, Linux, even mobile (eventually)
3. **Easy multiplayer** - WebSockets are native to the web
4. **Rapid iteration** - Hot module replacement, instant deploys
5. **Modding-friendly** - JSON data files, potential for Steam Workshop-like system
6. **Existing expertise** - Aligns with available development tooling (Node.js 20, TypeScript)

---

## Project Structure

```
pax-imperia-clone/
├── packages/
│   ├── client/              # Phaser 3 + React game client
│   │   ├── src/
│   │   │   ├── scenes/      # Phaser scenes (galaxy, system, combat, etc.)
│   │   │   ├── ui/          # React UI components (menus, HUD, dialogs)
│   │   │   ├── engine/      # Client-side game logic
│   │   │   ├── assets/      # Sprites, audio, fonts
│   │   │   └── network/     # Socket.io client wrapper
│   │   └── index.html
│   ├── server/              # Game server
│   │   ├── src/
│   │   │   ├── game/        # Authoritative game state management
│   │   │   ├── network/     # Socket.io server, room management
│   │   │   ├── ai/          # Computer player AI
│   │   │   ├── db/          # PostgreSQL models and queries
│   │   │   └── api/         # REST endpoints (auth, lobbies, leaderboards)
│   │   └── migrations/
│   └── shared/              # Shared types and data
│       ├── types/           # TypeScript interfaces/types
│       ├── data/            # JSON: tech trees, races, ships, weapons
│       ├── constants/       # Game balance constants
│       └── utils/           # Shared utility functions
├── docs/                    # Design documents, GDD
├── tools/                   # Map editor, data editors
├── .github/workflows/       # CI/CD
├── docker-compose.yml
├── package.json             # Monorepo root (npm workspaces)
└── PROJECT.md               # This file
```

---

## Milestone Roadmap

### Milestone 0: Foundation (Weeks 1-2)
**Goal**: Project scaffolding, tooling, and basic rendering
- [ ] Monorepo setup (npm workspaces, TypeScript, Vite, ESLint)
- [ ] Phaser 3 client bootstrap with basic scene management
- [ ] React UI overlay integration
- [ ] Node.js server bootstrap with Fastify + Socket.io
- [ ] PostgreSQL schema for accounts and game sessions
- [ ] Basic CI/CD pipeline
- [ ] Shared types package
- [ ] Dev environment documentation

### Milestone 1: Galaxy Generation & Navigation (Weeks 3-5)
**Goal**: Procedurally generated galaxy with navigable star systems
- [ ] Galaxy generation algorithm (stars, wormhole connections, cluster distribution)
- [ ] Galaxy map scene with pan/zoom (Phaser)
- [ ] Star system scene (orbital view with planets)
- [ ] Planet data model (atmosphere, gravity, resources, habitability)
- [ ] Wormhole pathfinding (A* on galaxy graph)
- [ ] Basic fog of war
- [ ] Galaxy map UI overlay (minimap, system info panel)

### Milestone 2: Species & Empire Setup (Weeks 6-8)
**Goal**: Race creation, empire initialization, and basic colonization
- [ ] Species data model (traits, bonuses, environmental preferences)
- [ ] 8 pre-built species with unique characteristics
- [ ] Custom species creator UI
- [ ] Empire initialization (home system, starting fleet, starting tech)
- [ ] Colony establishment mechanics
- [ ] Basic population growth model
- [ ] Planet management screen (buildings, production queues)
- [ ] Resource system (credits, minerals, research points)

### Milestone 3: Research & Technology (Weeks 9-11)
**Goal**: Full tech tree with meaningful progression
- [ ] Tech tree data structure (JSON-driven, moddable)
- [ ] 5 technology ages with progression gates
- [ ] Research categories: Weapons, Shields, Propulsion, Biology, Construction, Special
- [ ] Research screen UI with tree visualization
- [ ] Technology effects system (unlock ships, improve stats, enable abilities)
- [ ] Species-specific tech bonuses
- [ ] Research allocation per-planet

### Milestone 4: Ship Design & Fleet Management (Weeks 12-15)
**Goal**: Full ship design and fleet control
- [ ] Hull types: Scout, Destroyer, Transport, Cruiser, Carrier, Battleship
- [ ] Ship designer UI (slot-based component placement)
- [ ] Weapon systems (beam, projectile, missile, point defense, fighters)
- [ ] Ship systems (engines, shields, sensors, repair, special)
- [ ] Fleet composition and management
- [ ] Fleet movement on galaxy map (wormhole travel)
- [ ] Ship production queues at construction planets
- [ ] Fleet waypoints and patrol routes

### Milestone 5: Combat System (Weeks 16-19)
**Goal**: Real-time tactical combat
- [ ] Combat scene (separate Phaser scene for battles)
- [ ] Ship movement and formation AI
- [ ] Weapon firing mechanics (range, accuracy, damage types)
- [ ] Shield and armor systems
- [ ] Targeted system damage (engines, weapons, hull)
- [ ] Orbital defense structures
- [ ] Planetary bombardment
- [ ] Fighter/carrier operations
- [ ] Auto-resolve option for minor engagements
- [ ] Combat replay/log

### Milestone 6: Diplomacy & Espionage (Weeks 20-23)
**Goal**: Rich diplomatic interactions
- [ ] Alien leader portraits and personalities
- [ ] Diplomatic stance system (hostile to allied)
- [ ] Treaty types: Non-aggression, Trade, Research, Defense, Alliance
- [ ] Trade route system (economic links between empires)
- [ ] Espionage system (spy placement, intelligence gathering, sabotage)
- [ ] Diplomatic events and notifications
- [ ] Foreign affairs screen with relationship graph
- [ ] AI diplomacy behavior (personality-driven decisions)

### Milestone 7: AI & Single Player (Weeks 24-27)
**Goal**: Competent computer opponents
- [ ] Strategic AI (expansion, research priority, fleet composition)
- [ ] Tactical AI (combat positioning, target selection, retreat logic)
- [ ] Diplomatic AI (personality-based negotiation, grudges, alliances)
- [ ] Economic AI (planet specialization, resource balancing)
- [ ] Difficulty levels (no cheating; better decision-making at higher levels)
- [ ] AI personality templates (aggressive, defensive, economic, diplomatic)
- [ ] Tutorial campaign / guided scenario

### Milestone 8: Multiplayer (Weeks 28-31)
**Goal**: Online multiplayer with matchmaking
- [ ] Game lobby system
- [ ] Room creation with configurable settings
- [ ] Real-time game state synchronization
- [ ] Deterministic lockstep or server-authoritative architecture
- [ ] Reconnection handling
- [ ] Chat system (in-game and lobby)
- [ ] Matchmaking queue
- [ ] Player accounts and authentication
- [ ] Leaderboards and statistics

### Milestone 9: Victory, Balance & Polish (Weeks 32-35)
**Goal**: Complete game loop with multiple victory conditions
- [ ] Victory conditions: Conquest, Diplomatic, Technological, Economic, Score
- [ ] Game scoring system (per original: Economic, Military, Tech, Exploration)
- [ ] End-game screen with statistics and replay
- [ ] Game balance pass (tech costs, ship stats, resource rates)
- [ ] Sound effects and ambient audio
- [ ] Music system (moody space soundtrack)
- [ ] Visual polish (particle effects, transitions, animations)
- [ ] Performance optimization

### Milestone 10: Launch Preparation (Weeks 36-38)
**Goal**: Production-ready release
- [ ] Full game settings UI (audio, graphics, keybindings)
- [ ] Save/load game system
- [ ] Modding documentation and data file specs
- [ ] Accessibility features (colorblind modes, font scaling)
- [ ] Cross-browser testing
- [ ] Load testing for multiplayer servers
- [ ] Landing page and documentation site
- [ ] Open beta period

---

## Design Reference Links
- [GOG Store Page](https://www.gog.com/en/game/pax_imperia_eminent_domain)
- [MobyGames Entry](https://www.mobygames.com/game/2538/pax-imperia-eminent-domain/)
- [Wikipedia - Pax Imperia: Eminent Domain](https://en.wikipedia.org/wiki/Pax_Imperia:_Eminent_Domain)
- [GameSpot Review](https://www.gamespot.com/reviews/pax-imperia-eminent-domain-review/1900-2545803/)
- [Space Game Junkie Let's Play](https://www.spacegamejunkie.com/series/pax-imperia-eminent-domain-review/)
- [My Abandonware](https://www.myabandonware.com/game/pax-imperia-eminent-domain-cxo)
- [PCGamingWiki](https://www.pcgamingwiki.com/wiki/Pax_Imperia:_Eminent_Domain)

---

## License
TBD - Considering MIT or Apache 2.0 for the engine, with game content (art, music, data) under CC-BY-SA.

*Note: This is a fan project / spiritual successor. No original game assets will be used. All content is original.*
