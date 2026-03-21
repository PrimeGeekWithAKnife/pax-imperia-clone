import type { TechTree } from '../../src/types/technology.js';

import universalTree from './universal-tree.json' assert { type: 'json' };

/** The universal technology tree available to all empires. */
export const UNIVERSAL_TECH_TREE: TechTree = universalTree as TechTree;

/** All technologies in the universal tree, as a flat array. */
export const UNIVERSAL_TECHNOLOGIES = UNIVERSAL_TECH_TREE.technologies;

/** Lookup map from technology ID to Technology. */
export const UNIVERSAL_TECH_BY_ID: Readonly<Record<string, (typeof UNIVERSAL_TECHNOLOGIES)[number]>> =
  Object.fromEntries(UNIVERSAL_TECHNOLOGIES.map((t) => [t.id, t]));
