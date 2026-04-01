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

// -- All policies in display order ------------------------------------------------

const ALL_POLICIES: OccupationPolicy[] = [
  'peaceful_occupation',
  're_education',
  'decapitate_leadership',
  'raze_and_loot',
  'forced_labour',
  'enslavement',
  'mass_genocide',
];

// -- Policy metadata --------------------------------------------------------------

interface PolicyInfo {
  label: string;
  description: string;
  severity: 'benign' | 'moderate' | 'harsh' | 'extreme';
  /** Text shown when the policy is locked (not in allowedPolicies). */
  requirement: string;
}

const POLICY_INFO: Record<OccupationPolicy, PolicyInfo> = {
  peaceful_occupation: {
    label: 'Peaceful Occupation',
    description:
      'Minimal disruption, population kept intact. Requires policing forces but preserves infrastructure and goodwill.',
    severity: 'benign',
    requirement: 'Always available',
  },
  forced_labour: {
    label: 'Forced Labour',
    description:
      'Conscript the population into work gangs. Higher productivity but the populace will be deeply unhappy.',
    severity: 'harsh',
    requirement: 'Requires combat trait 4+',
  },
  re_education: {
    label: 'Re-education',
    description:
      'Impose your culture and values on the population. -20% pop, +loyalty over time.',
    severity: 'moderate',
    requirement: 'Always available',
  },
  decapitate_leadership: {
    label: 'Decapitate Leadership',
    description:
      'Eliminate enemy leadership and military officers. The general population is left intact but leaderless.',
    severity: 'moderate',
    requirement: 'Always available',
  },
  raze_and_loot: {
    label: 'Raze and Loot',
    description:
      'Strip resources and destroy infrastructure. -50% pop, +500 credits immediately.',
    severity: 'harsh',
    requirement: 'Always available',
  },
  enslavement: {
    label: 'Enslavement',
    description:
      'The entire population is enslaved. Maximum resource extraction at the cost of constant rebellion risk.',
    severity: 'extreme',
    requirement: 'Requires combat trait 7+',
  },
  mass_genocide: {
    label: 'Mass Genocide',
    description:
      'Exterminate the native population entirely. This is an irreversible atrocity that will horrify the galaxy.',
    severity: 'extreme',
    requirement: 'Requires combat trait 9+',
  },
};

const SEVERITY_COLOUR: Record<PolicyInfo['severity'], string> = {
  benign: '#55dd88',
  moderate: '#ddaa33',
  harsh: '#dd7733',
  extreme: '#ee4444',
};

// -- Component --------------------------------------------------------------------

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

  const allowedSet = new Set(allowedPolicies);

  const handleSelect = useCallback((policy: OccupationPolicy) => {
    if (!allowedSet.has(policy)) return; // locked policy -- do nothing
    setSelected(policy);
    setConfirmingGenocide(false);
    setGenocideConfirmCount(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowedPolicies]);

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
            You have conquered {planetName}! Population: {populationText}
          </p>
          <p className="occ-subtitle" style={{ marginTop: '4px' }}>
            Choose how to administer the occupied population:
          </p>
        </header>

        <section className="occ-policies" aria-label="Occupation policies">
          {ALL_POLICIES.map(policy => {
            const info = POLICY_INFO[policy];
            const isAllowed = allowedSet.has(policy);
            const isSelected = selected === policy;
            return (
              <button
                key={policy}
                type="button"
                className={[
                  'occ-policy-btn',
                  isSelected ? 'occ-policy-btn--selected' : '',
                  !isAllowed ? 'occ-policy-btn--locked' : '',
                ].filter(Boolean).join(' ')}
                onClick={() => handleSelect(policy)}
                disabled={!isAllowed}
                aria-disabled={!isAllowed}
              >
                <div className="occ-policy-header">
                  <span className="occ-policy-label">{info.label}</span>
                  <span
                    className="occ-policy-severity"
                    style={{ color: isAllowed ? SEVERITY_COLOUR[info.severity] : '#555' }}
                  >
                    {info.severity.toUpperCase()}
                  </span>
                </div>
                <p className="occ-policy-desc">{info.description}</p>
                {!isAllowed && (
                  <p className="occ-policy-locked-text">{info.requirement}</p>
                )}
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
