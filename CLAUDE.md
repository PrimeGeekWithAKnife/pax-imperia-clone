# Ex Nihilo - Development Instructions

## Project Overview
Modern web-based real-time 4X space strategy game.
Monorepo with npm workspaces: `packages/client`, `packages/server`, `packages/shared`.

## Deployment Pipeline

Every fix and feature follows this promotion path:

1. **DEV** → `192.168.1.172:5173` (ex-nihilo-dev, CT 108 on host2)
   - Deploy here FIRST after every commit
   - Developer tests here before anything else
2. **UAT** → `192.168.1.12:5173` (ex-nihilo-uat, CT 109 on pve2)
   - Promoted from DEV when the developer is satisfied with quality
3. **PROD** → `192.168.1.9:5173` (ex-nihilo-prod, CT 110 on pve2)
   - Promoted from UAT after user testing and feedback

### How to deploy

**DEV (.172)** — CT 108 on host2 (192.168.1.3), repo at `/opt/nova-imperia`:
```
# Credentials in .deploy-credentials (gitignored)
ssh.connect('192.168.1.3', username='root', password=<see .deploy-credentials>)
pct exec 108 -- bash -c 'cd /opt/nova-imperia && git fetch origin && git reset --hard origin/<branch> && npm run build && systemctl restart nova-imperia-client nova-imperia-server'
```

**UAT (.12)** — CT 109 on pve2 (192.168.1.6), repo at `/opt/ex-nihilo`:
```
ssh -i ~/.ssh/pve2_key root@192.168.1.6 "pct exec 109 -- bash -c 'cd /opt/ex-nihilo && git fetch origin && git reset --hard origin/<branch> && npm run build && systemctl restart ex-nihilo-client ex-nihilo-server'"
```

**PROD (.9)** — CT 110 on pve2, same pattern as UAT with CT 110.

Credentials for both Proxmox hosts are in `.deploy-credentials` (gitignored).
Always `git push` the branch before deploying — containers pull from GitHub.

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
