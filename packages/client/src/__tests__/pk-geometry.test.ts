import { describe, it } from 'vitest';
import { generateShipBuildResult, clearShipGeometryCache } from '../../game/rendering/ShipModels3D';

describe('PK geometry verification', () => {
  it('generates distinct geometry for planet_killer vs battleship', () => {
    clearShipGeometryCache();
    
    const bb = generateShipBuildResult('teranos', 'battleship');
    const pk = generateShipBuildResult('teranos', 'planet_killer');
    const hbb = generateShipBuildResult('teranos', 'heavy_battleship');
    const bs = generateShipBuildResult('teranos', 'battle_station');
    
    console.log('=== GEOMETRY COMPARISON ===');
    console.log(`Battleship:      bounds L=${bb.hardpoints.bounds.length.toFixed(1)} W=${bb.hardpoints.bounds.width.toFixed(1)} H=${bb.hardpoints.bounds.height.toFixed(1)} weapons=${bb.hardpoints.weapons.length} verts=${bb.geometry.attributes.position.count}`);
    console.log(`Heavy BB:        bounds L=${hbb.hardpoints.bounds.length.toFixed(1)} W=${hbb.hardpoints.bounds.width.toFixed(1)} H=${hbb.hardpoints.bounds.height.toFixed(1)} weapons=${hbb.hardpoints.weapons.length} verts=${hbb.geometry.attributes.position.count}`);
    console.log(`Battle Station:  bounds L=${bs.hardpoints.bounds.length.toFixed(1)} W=${bs.hardpoints.bounds.width.toFixed(1)} H=${bs.hardpoints.bounds.height.toFixed(1)} weapons=${bs.hardpoints.weapons.length} verts=${bs.geometry.attributes.position.count}`);
    console.log(`Planet Killer:   bounds L=${pk.hardpoints.bounds.length.toFixed(1)} W=${pk.hardpoints.bounds.width.toFixed(1)} H=${pk.hardpoints.bounds.height.toFixed(1)} weapons=${pk.hardpoints.weapons.length} verts=${pk.geometry.attributes.position.count}`);
    
    // They MUST be different
    console.log(`\nVertex count ratio PK/BB: ${(pk.geometry.attributes.position.count / bb.geometry.attributes.position.count).toFixed(1)}x`);
    console.log(`Length ratio PK/BB: ${(pk.hardpoints.bounds.length / bb.hardpoints.bounds.length).toFixed(1)}x`);
  });
});
