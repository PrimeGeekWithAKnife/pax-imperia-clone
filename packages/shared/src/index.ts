export { VERSION, BUILD_NUMBER, getVersionString } from './version.js';
export * from './types/index.js';
export * from './constants/index.js';
export * from './utils/index.js';
export * from './pathfinding/index.js';
export * from './generation/index.js';
export * from './validation/index.js';
export * from './engine/index.js';

// Game data (species, tech trees, ship components/hulls)
export {
  PREBUILT_SPECIES,
  PREBUILT_SPECIES_BY_ID,
} from '../data/species/index.js';
export {
  UNIVERSAL_TECH_TREE,
  UNIVERSAL_TECHNOLOGIES,
  UNIVERSAL_TECH_BY_ID,
} from '../data/tech/index.js';
export {
  HULL_TEMPLATES,
  HULL_TEMPLATE_BY_CLASS,
  SHIP_COMPONENTS,
  SHIP_COMPONENT_BY_ID,
  STARTING_COMPONENTS,
} from '../data/ships/index.js';
