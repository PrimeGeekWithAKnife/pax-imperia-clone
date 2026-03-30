const { SHIP_COMPONENT_BY_ID, HULL_TEMPLATE_BY_CLASS } = require('./packages/shared/dist/data/ships/index.js');
const { validateDesign } = require('./packages/shared/dist/engine/ship-design.js');

const hull = HULL_TEMPLATE_BY_CLASS['scout'];
const engine = SHIP_COMPONENT_BY_ID['ion_engine'];
const scanner = SHIP_COMPONENT_BY_ID['short_range_scanner'];
const laser = SHIP_COMPONENT_BY_ID['pulse_laser'];

const design = {
  id: 'test-design-1',
  name: 'Test Scout',
  hull: 'scout',
  components: [
    { slotId: 'scout_fore_1', componentId: laser.id },
    { slotId: 'scout_turret_1', componentId: scanner.id },
    { slotId: 'scout_aft_1', componentId: engine.id },
  ],
  totalCost: 0,
  empireId: 'empire-1',
};

const result = validateDesign(design, hull, [engine, scanner, laser]);
console.log('Valid:', result.valid);
console.log('Errors:', result.errors);
