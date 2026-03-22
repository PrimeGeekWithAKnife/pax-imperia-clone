import React, { useState } from 'react';
import type { SpecialAbility } from '@nova-imperia/shared';

interface AbilityInfo {
  key: SpecialAbility;
  icon: string;
  name: string;
  description: string;
}

export const ABILITY_INFO: AbilityInfo[] = [
  {
    key: 'psychic',
    icon: '🧠',
    name: 'Psychic',
    description: 'Enhanced mental abilities grant bonuses to espionage, diplomacy, and research. Can sense enemy movements.',
  },
  {
    key: 'aquatic',
    icon: '🌊',
    name: 'Aquatic',
    description: 'Evolved in oceanic environments. Colonize ocean worlds without penalty and gain food bonuses on water planets.',
  },
  {
    key: 'silicon_based',
    icon: '💎',
    name: 'Silicon-Based',
    description: 'Non-carbon biochemistry allows survival in extreme environments and immunity to many biological hazards.',
  },
  {
    key: 'hive_mind',
    icon: '🕸',
    name: 'Hive Mind',
    description: 'Collective consciousness eliminates morale penalties and boosts coordination. No individual dissent.',
  },
  {
    key: 'cybernetic',
    icon: '⚙',
    name: 'Cybernetic',
    description: 'Biological-mechanical integration. Faster construction, improved combat, and reduced food requirements.',
  },
  {
    key: 'nomadic',
    icon: '🚀',
    name: 'Nomadic',
    description: 'Spacefaring culture with natural ship handling bonuses. Colony ships are faster and cheaper.',
  },
  {
    key: 'subterranean',
    icon: '⛏',
    name: 'Subterranean',
    description: 'Underground dwellers with superior mining efficiency. Immune to orbital bombardment penalties.',
  },
  {
    key: 'photosynthetic',
    icon: '☀',
    name: 'Photosynthetic',
    description: 'Energy harvested directly from stars. Eliminates food shortages and provides free energy in high-luminosity systems.',
  },
  {
    key: 'energy_form',
    icon: '⚡',
    name: 'Energy Form',
    description: 'Exists as coherent energy rather than matter. Can pass through barriers and intercept communications, but struggles with physical construction.',
  },
  {
    key: 'symbiotic',
    icon: '🔗',
    name: 'Symbiotic',
    description: 'Bonds with host organisms to achieve full sapience. Compatible hosts gain enhanced cognition; incompatible hosts may be overridden.',
  },
  {
    key: 'synthetic',
    icon: '🤖',
    name: 'Synthetic',
    description: 'A machine intelligence that manufactures rather than reproduces. Immune to biological hazards, unaffected by atmosphere, tireless builders.',
  },
  {
    key: 'nanomorphic',
    icon: '🌫',
    name: 'Nanomorphic',
    description: 'A collective of nanoscale organisms that reconfigure into any form. Extreme adaptability to environments and rapid self-assembly of structures.',
  },
  {
    key: 'dimensional',
    icon: '🌀',
    name: 'Dimensional',
    description: 'Exists partially in another dimension. Ships and agents can phase through normal space, making detection and interception extraordinarily difficult.',
  },
  {
    key: 'devout',
    icon: '🕯',
    name: 'Devout',
    description: 'United by absolute faith. Generates high morale and faith output. Colonists work with tireless purpose, and soldiers fight with fanatical determination.',
  },
];

interface AbilityPickerProps {
  selected: SpecialAbility[];
  maxSelected?: number;
  onChange: (abilities: SpecialAbility[]) => void;
}

export function AbilityPicker({
  selected,
  maxSelected = 2,
  onChange,
}: AbilityPickerProps): React.ReactElement {
  const [hoveredKey, setHoveredKey] = useState<SpecialAbility | null>(null);

  const handleToggle = (key: SpecialAbility) => {
    if (selected.includes(key)) {
      onChange(selected.filter((a) => a !== key));
    } else if (selected.length < maxSelected) {
      onChange([...selected, key]);
    }
  };

  return (
    <div className="ability-picker">
      <div className="ability-picker__grid">
        {ABILITY_INFO.map((ability) => {
          const isSelected = selected.includes(ability.key);
          const isDisabled = !isSelected && selected.length >= maxSelected;

          return (
            <button
              key={ability.key}
              className={[
                'ability-card',
                isSelected ? 'ability-card--selected' : '',
                isDisabled ? 'ability-card--disabled' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => handleToggle(ability.key)}
              onMouseEnter={() => setHoveredKey(ability.key)}
              onMouseLeave={() => setHoveredKey(null)}
              disabled={isDisabled}
              title={ability.description}
              type="button"
            >
              <span className="ability-card__icon">{ability.icon}</span>
              <span className="ability-card__name">{ability.name}</span>
              {isSelected && <span className="ability-card__check">✓</span>}
            </button>
          );
        })}
      </div>
      {hoveredKey && (
        <div className="ability-picker__description">
          {ABILITY_INFO.find((a) => a.key === hoveredKey)?.description}
        </div>
      )}
      <div className="ability-picker__count">
        {selected.length}/{maxSelected} selected
      </div>
    </div>
  );
}
