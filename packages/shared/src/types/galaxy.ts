/** Core galaxy and star system types */

export interface Position2D {
  x: number;
  y: number;
}

export interface StarSystem {
  id: string;
  name: string;
  position: Position2D;
  starType: StarType;
  planets: Planet[];
  wormholes: string[]; // IDs of connected star systems
  ownerId: string | null;
  discovered: Record<string, boolean>; // empireId -> discovered
}

export type StarType =
  | 'blue_giant'
  | 'white'
  | 'yellow'
  | 'orange'
  | 'red_dwarf'
  | 'red_giant'
  | 'neutron'
  | 'binary';

export interface Planet {
  id: string;
  name: string;
  orbitalIndex: number;
  type: PlanetType;
  atmosphere: AtmosphereType;
  gravity: number; // 0.1 to 3.0 (Earth = 1.0)
  temperature: number; // Kelvin
  naturalResources: number; // 0-100 wealth rating
  maxPopulation: number;
  currentPopulation: number;
  ownerId: string | null;
  buildings: Building[];
  productionQueue: ProductionItem[];
}

export type PlanetType =
  | 'terran'
  | 'ocean'
  | 'desert'
  | 'ice'
  | 'volcanic'
  | 'gas_giant'
  | 'barren'
  | 'toxic';

export type AtmosphereType =
  | 'oxygen_nitrogen'
  | 'nitrogen'
  | 'carbon_dioxide'
  | 'methane'
  | 'ammonia'
  | 'sulfur_dioxide'
  | 'hydrogen'
  | 'hydrogen_helium'
  | 'none'
  | 'toxic'
  | 'vacuum';

export interface Building {
  id: string;
  type: BuildingType;
  level: number;
}

export type BuildingType =
  | 'research_lab'
  | 'factory'
  | 'shipyard'
  | 'trade_hub'
  | 'defense_grid'
  | 'population_center'
  | 'mining_facility'
  | 'spaceport'
  | 'power_plant';

export interface ProductionItem {
  type: 'ship' | 'building' | 'defense';
  templateId: string;
  turnsRemaining: number;
}

export interface Galaxy {
  id: string;
  systems: StarSystem[];
  width: number;
  height: number;
  seed: number;
}
