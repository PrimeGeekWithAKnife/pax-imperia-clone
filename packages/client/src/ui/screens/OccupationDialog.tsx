import React, { useCallback, useState } from 'react';
import type { OccupationPolicy } from '@nova-imperia/shared';
export { getAllowedPolicies } from '@nova-imperia/shared';
export type { OccupationPolicy } from '@nova-imperia/shared';

export interface OccupationDialogProps {
  planetName: string;
  planetPopulation: number;
  playerSpeciesId: string;
  /** Peaceful races cannot choose genocide, etc. */
  allowedPolicies: OccupationPolicy[];
  onSelectPolicy: (policy: OccupationPolicy) => void;
  onClose: () => void;
}

// ── Policy metadata ──────────────────────────────────────────────────────────

interface PolicyInfo {
  label: string;
  description: string;
  severity: 'benign' | 'moderate' | 'harsh' | 'extreme';
}

const POLICY_INFO: Record<OccupationPolicy, PolicyInfo> = {
  peaceful_occupation: {
    label: 'Peaceful Occupation',
    description:
      'Minimal unrest, slow integration. Requires policing forces but preserves infrastructure and goodwill.',
    severity: 'benign',
  },
  forced_labour: {
    label: 'Forced Labour',
    description:
      'Conscript the population into work gangs. Higher productivity but the populace will be deeply unhappy.',
    severity: 'harsh',
  },
  re_education: {
    label: 'Re-education',
    description:
      'Convert the population to your culture and values. A slow process with moderate initial unrest.',
    severity: 'moderate',
  },
  decapitate_leadership: {
    label: 'Decapitate Leadership',
    description:
      'Eliminate enemy leadership and military officers. The general population is left intact but leaderless.',
    severity: 'moderate',
  },
  raze_and_loot: {
    label: 'Raze and Loot',
    description:
      'Destroy infrastructure and take everything of value. Most of the population survives but the planet is set back decades.',
    severity: 'harsh',
  },
  enslavement: {
    label: 'Enslavement',
    description:
      'The entire population is enslaved. Maximum resource extraction at the cost of constant rebellion risk.',
    severity: 'extreme',
  },
  mass_genocide: {
    label: 'Mass Genocide',
    description:
      'Exterminate the native population entirely. This is an irreversible atrocity that will horrify the galaxy.',
    severity: 'extreme',
  },
};

const SEVERITY_COLOUR: Record<PolicyInfo['severity'], string> = {
  benign: '#55dd88',
  moderate: '#ddaa33',
  harsh: '#dd7733',
  extreme: '#ee4444',
};

// ── Component ─────────────────────────────────────────────────────────────────

export function OccupationDialog({
  planetName,
  planetPopulation,
  allowedPolicies,
  onSelectPolicy,
  onClose,
}: OccupationDialogProps): React.ReactElement {
  const [selected, setSelected] = useState<OccupationPolicy | null>(null);
  const [confirmingGenocide, setConfirmingGenocide] = useState(false);
  const [genocideConfirmCount, setGenocideConfirmCount] = useState(0);

  const GENOCIDE_CONFIRMS_REQUIRED = 3;

  const handleSelect = useCallback((policy: OccupationPolicy) => {
    setSelected(policy);
    setConfirmingGenocide(false);
    setGenocideConfirmCount(0);
  }, []);

  const handleConfirm = useCallback(() => {
    if (!selected) return;

    if (selected === 'mass_genocide') {
      if (genocideConfirmCount + 1 < GENOCIDE_CONFIRMS_REQUIRED) {
        setConfirmingGenocide(true);
        setGenocideConfirmCount(prev => prev + 1);
        return;
      }
    }

    onSelectPolicy(selected);
  }, [selected, genocideConfirmCount, onSelectPolicy]);

  const populationText =
    planetPopulation >= 1_000_000
      ? `${(planetPopulation / 1_000_000).toFixed(1)}M`
      : planetPopulation >= 1_000
        ? `${(planetPopulation / 1_000).toFixed(0)}K`
        : String(planetPopulation);

  return (
    <div className="occ-overlay" role="dialog" aria-modal="true" aria-label="Occupation policy">
      <div className="occ-modal">
        <header className="occ-header">
          <h1 className="occ-title">OCCUPATION OF {planetName.toUpperCase()}</h1>
          <p className="occ-subtitle">
            Population: {populationText}
          </p>
        </header>

        <section className="occ-policies" aria-label="Occupation policies">
          {allowedPolicies.map(policy => {
            const info = POLICY_INFO[policy];
            const isSelected = selected === policy;
            return (
              <button
                key={policy}
                type="button"
                className={`occ-policy-btn ${isSelected ? 'occ-policy-btn--selected' : ''}`}
                onClick={() => handleSelect(policy)}
              >
                <div className="occ-policy-header">
                  <span className="occ-policy-label">{info.label}</span>
                  <span
                    className="occ-policy-severity"
                    style={{ color: SEVERITY_COLOUR[info.severity] }}
                  >
                    {info.severity.toUpperCase()}
                  </span>
                </div>
                <p className="occ-policy-desc">{info.description}</p>
              </button>
            );
          })}
        </section>

        <footer className="occ-footer">
          {selected && confirmingGenocide && selected === 'mass_genocide' && (
            <p className="occ-genocide-warning">
              Are you absolutely certain? This is an irreversible atrocity.
              ({genocideConfirmCount}/{GENOCIDE_CONFIRMS_REQUIRED} confirmations)
            </p>
          )}
          <div className="occ-footer-buttons">
            <button
              type="button"
              className="occ-cancel-btn"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="occ-confirm-btn"
              disabled={!selected}
              onClick={handleConfirm}
            >
              {selected === 'mass_genocide' && genocideConfirmCount < GENOCIDE_CONFIRMS_REQUIRED - 1
                ? `Confirm (${genocideConfirmCount + 1}/${GENOCIDE_CONFIRMS_REQUIRED})`
                : 'Confirm Policy'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

