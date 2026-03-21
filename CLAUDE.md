# Nova Imperia - Development Instructions

## Project Overview
Modern web-based clone of Pax Imperia: Eminent Domain (1997 4X space strategy game).
Monorepo with npm workspaces: `packages/client`, `packages/server`, `packages/shared`.

## Tech Stack
- **Language**: TypeScript (strict mode)
- **Client**: Phaser 3 (game engine) + React (UI overlays) + Vite (build)
- **Server**: Node.js + Fastify + Socket.io
- **Database**: PostgreSQL
- **Testing**: Vitest
- **Shared**: Common types and game data between client/server

## Development Commands
- `npm run dev` - Start all packages in dev mode
- `npm run build` - Build all packages
- `npm run test` - Run all tests
- `npm run lint` - Lint all source files
- `npm run typecheck` - TypeScript type checking

## Code Conventions
- Use TypeScript strict mode everywhere
- Shared game types go in `packages/shared/types/`
- Game balance data is JSON in `packages/shared/data/` (moddable)
- Prefer composition over inheritance for game entities
- Use Zod for runtime validation of external data
- Write tests for game logic (tech tree, combat resolution, resource calculations)
- Keep Phaser scenes thin; game logic belongs in engine classes

## Architecture Notes
- Client-server architecture with server-authoritative game state
- Phaser handles rendering; React handles UI panels/menus
- Socket.io for real-time game state sync
- Galaxy is a graph of star systems connected by wormholes
- All game data (tech trees, races, ships) is JSON-driven for modding support
