/**
 * Nova Imperia - Game Server Entry Point
 * Fastify + Socket.io game server
 */

import type { Galaxy } from '@nova-imperia/shared';

const config: Pick<Galaxy, 'seed'> & { name: string } = {
  name: 'Nova Imperia Server',
  seed: 1,
};

console.log('Nova Imperia Server - Initializing...', config.name);

// Fastify and Socket.io bootstrapping will be added in Phase 5
