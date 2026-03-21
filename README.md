# Nova Imperia

A modern, web-based reimagining of **Pax Imperia: Eminent Domain** (1997) - the real-time 4X space strategy game.

Build your empire across a galaxy of interconnected star systems. Customize your species, design warships, research technologies, negotiate with alien civilizations, and wage real-time tactical battles for galactic dominance.

## Features (Planned)

- **Procedural Galaxy Generation** - Unique star systems connected by wormholes
- **Deep Species Customization** - 8 pre-built races + full custom species creator
- **300+ Technologies** - Research tree spanning 5 technological ages
- **Ship Designer** - Build ships from hull templates with modular components
- **Real-Time Combat** - Tactical fleet battles with targeted system damage
- **Rich Diplomacy** - Treaties, trade, espionage, and alien personalities
- **Multiplayer** - Online play with lobbies and matchmaking
- **Moddable** - JSON-driven game data for community content

## Tech Stack

- **Client**: TypeScript + Phaser 3 + React + Vite
- **Server**: Node.js + Fastify + Socket.io
- **Database**: PostgreSQL + Redis
- **Monorepo**: npm workspaces

## Getting Started

```bash
# Clone the repository
git clone https://github.com/PrimeGeekWithAKnife/pax-imperia-clone.git
cd pax-imperia-clone

# Install dependencies
npm install

# Start development servers
npm run dev
```

## Project Structure

```
packages/
  client/    - Phaser 3 game client with React UI
  server/    - Fastify + Socket.io game server
  shared/    - Shared TypeScript types and game data
docs/        - Design documents
```

## Inspired By

[Pax Imperia: Eminent Domain](https://en.wikipedia.org/wiki/Pax_Imperia:_Eminent_Domain) (1997) by Heliotrope Studios / THQ. This is an original fan project; no original game assets are used.

## License

MIT
