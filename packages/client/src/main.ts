/**
 * Nova Imperia - Game Client Entry Point
 * A modern clone of Pax Imperia: Eminent Domain
 */

import type { Galaxy } from '@nova-imperia/shared';

const config: Pick<Galaxy, 'seed'> & { name: string } = {
  name: 'Nova Imperia Galaxy',
  seed: 42,
};

console.log('Nova Imperia - Initializing...', config.name);

// Phaser and React bootstrapping will be added in Phase 3-4
