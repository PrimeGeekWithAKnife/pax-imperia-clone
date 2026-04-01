/**
 * Barrel export for all procedural graphics modules.
 *
 * Both ShipGraphics and BuildingGraphics use Canvas 2D to paint icons and
 * return PNG data URIs.  Components import from this barrel so that the
 * import paths stay stable regardless of internal refactoring.
 */

export { renderShipIcon, renderShipThumbnail, clearShipIconCache } from './ShipGraphics';
export { renderBuildingIcon, renderBuildingSlotIcon } from './BuildingGraphics';
export { getDesignFamily, getFamilyDrawFn, SPECIES_DESIGN_FAMILY } from './ShipDesignFamilies';
export type { DesignFamily } from './ShipDesignFamilies';
