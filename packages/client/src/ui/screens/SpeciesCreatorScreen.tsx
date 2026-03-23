import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { Species, SpeciesTraits, EnvironmentPreference, SpecialAbility } from '@nova-imperia/shared';
import { TraitSlider } from '../components/TraitSlider';
import { AbilityPicker, ABILITY_INFO } from '../components/AbilityPicker';
import { portraitCache } from '../../game/rendering/portraitCache';
import { ORIGIN_TO_BASE_SHAPE, ORIGIN_TO_COLORS } from '../../game/rendering/PortraitRenderer';
import type { PortraitOptions } from '../../game/rendering/PortraitRenderer';

// ── Constants ──────────────────────────────────────────────────────────────────

const TRAIT_BUDGET = 42;

const TRAIT_KEYS: Array<keyof SpeciesTraits> = [
  'construction',
  'reproduction',
  'research',
  'espionage',
  'economy',
  'combat',
  'diplomacy',
];

const TRAIT_LABELS: Record<keyof SpeciesTraits, string> = {
  construction: 'Construction',
  reproduction: 'Reproduction',
  research: 'Research',
  espionage: 'Espionage',
  economy: 'Economy',
  combat: 'Combat',
  diplomacy: 'Diplomacy',
};

const TRAIT_DESCRIPTIONS: Record<keyof SpeciesTraits, string> = {
  construction: 'Building and ship production speed. Higher values reduce build times significantly.',
  reproduction: 'Population growth rate. Affects colony development speed and workforce size.',
  research: 'Technology research speed. Determines how quickly new technologies are discovered.',
  espionage: 'Spy effectiveness. Affects success rates of intelligence operations and counterintelligence.',
  economy: 'Credit generation multiplier. Scales all income from trade, taxation, and commerce.',
  combat: 'Ship combat effectiveness. Multiplies attack and defense ratings of all military vessels.',
  diplomacy: 'Diplomatic relationship bonuses. Improves treaty success rates and reduces tensions.',
};

const ATMOSPHERE_TYPES = [
  'oxygen_nitrogen',
  'carbon_dioxide',
  'methane',
  'ammonia',
  'hydrogen',
  'hydrogen_helium',
  'sulfur_dioxide',
  'none',
] as const;

type AtmosphereType = (typeof ATMOSPHERE_TYPES)[number];

const ATMOSPHERE_LABELS: Record<AtmosphereType, string> = {
  oxygen_nitrogen: 'N\u2082/O\u2082 (Earth-like)',
  carbon_dioxide: 'CO\u2082',
  methane: 'Methane',
  ammonia: 'Ammonia',
  hydrogen: 'Hydrogen',
  hydrogen_helium: 'H\u2082/He (Gas Giant)',
  sulfur_dioxide: 'SO\u2082',
  none: 'None/Vacuum',
};

const ORIGIN_STORIES = [
  'Balanced',
  'Bioengineering',
  'Industrial',
  'Psionic',
  'Cybernetic',
  'Nomadic',
  'Aquatic',
  'Subterranean',
] as const;

type OriginStory = (typeof ORIGIN_STORIES)[number];

interface OriginPreset {
  traits: SpeciesTraits;
  abilities: SpecialAbility[];
  description: string;
}

const ORIGIN_PRESETS: Record<OriginStory, OriginPreset> = {
  Balanced: {
    traits: { construction: 6, reproduction: 6, research: 6, espionage: 6, economy: 6, combat: 6, diplomacy: 6 },
    abilities: [],
    description: 'A well-rounded species with no particular strengths or weaknesses.',
  },
  Bioengineering: {
    traits: { construction: 4, reproduction: 9, research: 8, espionage: 5, economy: 5, combat: 4, diplomacy: 7 },
    abilities: ['psychic'],
    description: 'Masters of life sciences who engineered themselves to perfection.',
  },
  Industrial: {
    traits: { construction: 10, reproduction: 5, research: 5, espionage: 4, economy: 8, combat: 6, diplomacy: 4 },
    abilities: [],
    description: 'Born in factory worlds, these beings build empires at machine speed.',
  },
  Psionic: {
    traits: { construction: 4, reproduction: 5, research: 9, espionage: 9, economy: 5, combat: 5, diplomacy: 5 },
    abilities: ['psychic'],
    description: 'Mental titans whose minds reach across the void of space.',
  },
  Cybernetic: {
    traits: { construction: 7, reproduction: 3, research: 8, espionage: 6, economy: 7, combat: 7, diplomacy: 4 },
    abilities: ['cybernetic'],
    description: 'Half machine, half organism \u2014 cold, efficient, relentless.',
  },
  Nomadic: {
    traits: { construction: 5, reproduction: 6, research: 5, espionage: 7, economy: 8, combat: 7, diplomacy: 4 },
    abilities: ['nomadic'],
    description: 'Spacefaring wanderers who call no single world home.',
  },
  Aquatic: {
    traits: { construction: 5, reproduction: 7, research: 6, espionage: 5, economy: 7, combat: 5, diplomacy: 7 },
    abilities: ['aquatic'],
    description: 'Evolved in vast oceans, now reaching for the stars above.',
  },
  Subterranean: {
    traits: { construction: 8, reproduction: 6, research: 6, espionage: 8, economy: 5, combat: 5, diplomacy: 4 },
    abilities: ['subterranean'],
    description: 'Deep-dwellers who carved civilisations from bedrock.',
  },
};

// Map pre-built species to template format for the species creator
import { PREBUILT_SPECIES } from '@nova-imperia/shared';

const ORIGIN_MAP: Record<string, OriginStory> = {
  vaelori: 'Psionic', khazari: 'Industrial', sylvani: 'Bioengineering',
  nexari: 'Cybernetic', drakmari: 'Aquatic', teranos: 'Balanced',
  zorvathi: 'Subterranean', ashkari: 'Nomadic',
  luminari: 'Psionic', vethara: 'Bioengineering', kaelenth: 'Industrial',
  thyriaq: 'Bioengineering', aethyn: 'Psionic', orivani: 'Balanced',
  pyrenth: 'Subterranean',
};
const TEMPLATE_SPECIES = PREBUILT_SPECIES.map(s => ({
  name: s.name,
  traits: s.traits,
  abilities: s.specialAbilities,
  origin: ORIGIN_MAP[s.id] ?? 'Balanced' as OriginStory,
  description: s.description,
  id: s.id,
}));

// Temperature labels
function temperatureLabel(k: number): string {
  if (k < 200) return 'Frozen';
  if (k < 260) return 'Cold';
  if (k < 320) return 'Temperate';
  if (k < 400) return 'Warm';
  return 'Scorching';
}

// Planet habitability preview
function habitabilityDescription(env: EnvironmentPreference): string {
  const temp = temperatureLabel(env.idealTemperature);
  const grav = env.idealGravity < 0.6 ? 'low' : env.idealGravity > 1.5 ? 'high' : 'standard';
  const atm = env.preferredAtmospheres.length === 0
    ? 'any atmosphere'
    : env.preferredAtmospheres.map((a) => ATMOSPHERE_LABELS[a as AtmosphereType] ?? a).join(', ');
  return `${temp} worlds with ${grav} gravity and ${atm}.`;
}

// ── Default state ──────────────────────────────────────────────────────────────

function defaultTraits(): SpeciesTraits {
  return { construction: 6, reproduction: 6, research: 6, espionage: 6, economy: 6, combat: 6, diplomacy: 6 };
}

function defaultEnv(): EnvironmentPreference {
  return {
    idealTemperature: 290,
    temperatureTolerance: 40,
    idealGravity: 1.0,
    gravityTolerance: 0.3,
    preferredAtmospheres: ['oxygen_nitrogen'],
  };
}

// ── Race Picker Card ──────────────────────────────────────────────────────────

interface RaceCardProps {
  species: Species;
  onClick: () => void;
}

function RaceCard({ species, onClick }: RaceCardProps): React.ReactElement {
  const portraitUrl = useMemo(() => portraitCache.getPortrait(species.id, 72), [species.id]);
  const maxVal = Math.max(...TRAIT_KEYS.map(k => species.traits[k]));

  // Truncate description to 150 characters
  const shortDesc = species.description.length > 150
    ? species.description.slice(0, 147) + '...'
    : species.description;

  return (
    <button className="race-card" onClick={onClick} type="button">
      {/* Portrait + Name header */}
      <div className="race-card__header">
        <div className="race-card__portrait">
          <img src={portraitUrl} alt={species.name} className="race-card__portrait-img" />
        </div>
        <div className="race-card__identity">
          <div className="race-card__name">{species.name}</div>
          {species.specialAbilities.length > 0 && (
            <div className="race-card__abilities">
              {species.specialAbilities.map(key => {
                const info = ABILITY_INFO.find(a => a.key === key);
                return info ? (
                  <span key={key} className="race-card__ability" title={info.description}>
                    {info.icon} {info.name}
                  </span>
                ) : null;
              })}
            </div>
          )}
        </div>
      </div>

      {/* Short description */}
      <div className="race-card__desc">{shortDesc}</div>

      {/* Compact trait bars */}
      <div className="race-card__traits">
        {TRAIT_KEYS.map(key => {
          const val = species.traits[key];
          const pct = (val / 10) * 100;
          const isTop = val === maxVal;
          return (
            <div key={key} className="race-card__trait-row">
              <span className="race-card__trait-label">{TRAIT_LABELS[key].slice(0, 3).toUpperCase()}</span>
              <div className="race-card__trait-track">
                <div
                  className="race-card__trait-fill"
                  style={{
                    width: `${pct}%`,
                    background: isTop ? 'var(--color-accent)' : 'rgba(0,180,220,0.45)',
                    boxShadow: isTop ? '0 0 6px var(--color-accent)' : 'none',
                  }}
                />
              </div>
              <span className="race-card__trait-val">{val}</span>
            </div>
          );
        })}
      </div>
    </button>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export interface SpeciesCreatorContinueData {
  species: Species;
  originStory: string;
}

interface SpeciesCreatorScreenProps {
  onBack: () => void;
  /** Called when the player clicks "Continue" to proceed to game setup. */
  onContinue: (data: SpeciesCreatorContinueData) => void;
}

type ScreenMode = 'pick-race' | 'custom';

export function SpeciesCreatorScreen({
  onBack,
  onContinue,
}: SpeciesCreatorScreenProps): React.ReactElement {
  // Mode: race picker (default) vs custom species editor
  const [mode, setMode] = useState<ScreenMode>('pick-race');

  // ── Pick Race: click a pre-built species and go straight to game setup ──
  const handlePickRace = useCallback((species: Species) => {
    const originStory = ORIGIN_MAP[species.id] ?? 'Balanced';
    onContinue({ species, originStory });
  }, [onContinue]);

  // ── Custom Species editor state ─────────────────────────────────────────
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [origin, setOrigin] = useState<OriginStory>('Balanced');
  const [traits, setTraits] = useState<SpeciesTraits>(defaultTraits);
  const [env, setEnv] = useState<EnvironmentPreference>(defaultEnv);
  const [abilities, setAbilities] = useState<SpecialAbility[]>([]);

  // Portrait colour customisation -- seeded from the initial origin palette
  const [primaryColor, setPrimaryColor] = useState(() => (ORIGIN_TO_COLORS['Balanced'] ?? ['#2d6b8a', '#4aa8cc', '#00d4ff'])[0]);
  const [secondaryColor, setSecondaryColor] = useState(() => (ORIGIN_TO_COLORS['Balanced'] ?? ['#2d6b8a', '#4aa8cc', '#00d4ff'])[1]);
  const [accentColor, setAccentColor] = useState(() => (ORIGIN_TO_COLORS['Balanced'] ?? ['#2d6b8a', '#4aa8cc', '#00d4ff'])[2]);

  // Portrait data URL (re-rendered when portrait options change)
  const [portraitUrl, setPortraitUrl] = useState<string>('');
  const portraitDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derived
  const traitTotal = useMemo(
    () => TRAIT_KEYS.reduce((sum, k) => sum + traits[k], 0),
    [traits],
  );
  const pointsRemaining = TRAIT_BUDGET - traitTotal;
  const overBudget = pointsRemaining < 0;
  const isValid = name.trim().length > 0 && !overBudget;

  // Build portrait options from current state
  const portraitOptions = useMemo<PortraitOptions>(() => ({
    baseShape: ORIGIN_TO_BASE_SHAPE[origin] ?? 'humanoid',
    primaryColor,
    secondaryColor,
    accentColor,
    features: [],
  }), [origin, primaryColor, secondaryColor, accentColor]);

  // Re-render portrait when options change (debounced so colour pickers don't thrash)
  useEffect(() => {
    if (portraitDebounceRef.current) clearTimeout(portraitDebounceRef.current);
    portraitDebounceRef.current = setTimeout(() => {
      const url = portraitCache.getCustomPortrait(portraitOptions, 128);
      setPortraitUrl(url);
    }, 80);
    return () => {
      if (portraitDebounceRef.current) clearTimeout(portraitDebounceRef.current);
    };
  }, [portraitOptions]);

  // Trait change handler
  const handleTraitChange = useCallback((key: keyof SpeciesTraits, value: number) => {
    setTraits((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Origin selection -- auto-fill suggested traits/abilities + matching colour palette
  const handleOriginChange = useCallback((newOrigin: OriginStory) => {
    setOrigin(newOrigin);
    const preset = ORIGIN_PRESETS[newOrigin];
    setTraits(preset.traits);
    setAbilities(preset.abilities);
    const colors = ORIGIN_TO_COLORS[newOrigin];
    if (colors) {
      setPrimaryColor(colors[0]);
      setSecondaryColor(colors[1]);
      setAccentColor(colors[2]);
      // Bust the portrait cache so the new colours are picked up immediately
      portraitCache.clear();
    }
  }, []);

  // Atmosphere multi-select
  const handleAtmosphereToggle = useCallback((atm: AtmosphereType) => {
    setEnv((prev) => {
      const has = prev.preferredAtmospheres.includes(atm);
      return {
        ...prev,
        preferredAtmospheres: has
          ? prev.preferredAtmospheres.filter((a) => a !== atm)
          : [...prev.preferredAtmospheres, atm],
      };
    });
  }, []);

  // Randomise
  const handleRandomize = useCallback(() => {
    const names = ['Zethori', 'Valkrath', 'Nuuri', 'Thyssen', 'Orakkai', 'Serrath', 'Umbari', 'Phexis'];
    setName(names[Math.floor(Math.random() * names.length)] ?? 'Zethori');

    // Generate random traits that sum to TRAIT_BUDGET
    const randomTraits = { ...defaultTraits() };
    let remaining = TRAIT_BUDGET;
    const keys = [...TRAIT_KEYS];
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i]!;
      const maxVal = Math.min(10, remaining - (keys.length - i - 1));
      const minVal = 1;
      const val = Math.floor(Math.random() * (maxVal - minVal + 1)) + minVal;
      randomTraits[key] = val;
      remaining -= val;
    }
    const lastKey = keys[keys.length - 1]!;
    randomTraits[lastKey] = Math.max(1, Math.min(10, remaining));
    setTraits(randomTraits);

    // Random abilities
    const abilityKeys: SpecialAbility[] = ABILITY_INFO.map((a) => a.key);
    const shuffled = abilityKeys.sort(() => Math.random() - 0.5);
    setAbilities(shuffled.slice(0, Math.floor(Math.random() * 3)));

    // Random origin
    const origins = [...ORIGIN_STORIES];
    setOrigin(origins[Math.floor(Math.random() * origins.length)] ?? 'Balanced');

    // Random environment
    setEnv({
      idealTemperature: Math.round(150 + Math.random() * 350),
      temperatureTolerance: Math.round(10 + Math.random() * 90),
      idealGravity: Math.round((0.1 + Math.random() * 2.9) * 10) / 10,
      gravityTolerance: Math.round((0.1 + Math.random() * 0.9) * 10) / 10,
      preferredAtmospheres: [ATMOSPHERE_TYPES[Math.floor(Math.random() * ATMOSPHERE_TYPES.length)] ?? 'oxygen_nitrogen'],
    });
  }, []);

  // Continue to game setup (custom species)
  const handleStartGame = useCallback(() => {
    if (!isValid) return;

    const species: Species = {
      id: `player_${Date.now()}`,
      name: name.trim(),
      description: description.trim() || `The ${name.trim()} are an empire shaped by their ${origin.toLowerCase()} origins.`,
      portrait: 'player',
      traits,
      environmentPreference: env,
      specialAbilities: abilities,
      isPrebuilt: false,
    };

    onContinue({ species, originStory: origin });
  }, [isValid, name, description, origin, traits, env, abilities, onContinue]);

  // Preview: trait bar chart
  const maxTraitVal = Math.max(...TRAIT_KEYS.map((k) => traits[k]));

  // ═══════════════════════════════════════════════════════════════════════════
  //  RACE PICKER MODE (default)
  // ═══════════════════════════════════════════════════════════════════════════
  if (mode === 'pick-race') {
    return (
      <div className="species-creator-overlay">
        <div className="race-picker">
          {/* Header */}
          <div className="race-picker__header">
            <div className="race-picker__title">CHOOSE YOUR SPECIES</div>
            <div className="race-picker__subtitle">
              Select a species to lead through the galaxy, or craft your own from scratch
            </div>
          </div>

          {/* Grid of all 15 species */}
          <div className="race-picker__grid">
            {PREBUILT_SPECIES.map(species => (
              <RaceCard
                key={species.id}
                species={species}
                onClick={() => handlePickRace(species)}
              />
            ))}
          </div>

          {/* Footer */}
          <div className="race-picker__footer">
            <button type="button" className="sc-btn sc-btn--secondary" onClick={onBack}>
              &larr; Back
            </button>
            <button
              type="button"
              className="sc-btn sc-btn--primary"
              onClick={() => setMode('custom')}
            >
              Create Custom Species +
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  CUSTOM SPECIES EDITOR MODE
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="species-creator-overlay">
      <div className="species-creator">
        {/* Header */}
        <div className="species-creator__header">
          <div className="species-creator__title">SPECIES CREATOR</div>
          <div className="species-creator__subtitle">
            Design your species &mdash; traits and choices persist throughout the galaxy
          </div>
        </div>

        {/* Main content: two columns */}
        <div className="species-creator__body">
          {/* -- Left column: controls -- */}
          <div className="species-creator__left">

            {/* Name & Description */}
            <section className="sc-section">
              <div className="sc-section__label">IDENTITY</div>
              <div className="sc-field">
                <label className="sc-field__label" htmlFor="species-name">Species Name</label>
                <input
                  id="species-name"
                  className="sc-input"
                  type="text"
                  placeholder="Enter species name..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={40}
                />
              </div>
              <div className="sc-field">
                <label className="sc-field__label" htmlFor="species-desc">Description</label>
                <textarea
                  id="species-desc"
                  className="sc-input sc-input--textarea"
                  placeholder="Brief description of your species..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  maxLength={200}
                />
              </div>
            </section>

            {/* Origin Story */}
            <section className="sc-section">
              <div className="sc-section__label">ORIGIN STORY</div>
              <select
                className="sc-input sc-input--select"
                value={origin}
                onChange={(e) => handleOriginChange(e.target.value as OriginStory)}
              >
                {ORIGIN_STORIES.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
              <div className="sc-origin-desc">{ORIGIN_PRESETS[origin].description}</div>
            </section>

            {/* Trait Allocation */}
            <section className="sc-section">
              <div className="sc-section__label-row">
                <span className="sc-section__label">TRAIT ALLOCATION</span>
                <span
                  className={`sc-budget ${overBudget ? 'sc-budget--over' : pointsRemaining <= 4 ? 'sc-budget--warn' : 'sc-budget--ok'}`}
                >
                  {pointsRemaining >= 0 ? `${pointsRemaining} pts remaining` : `${Math.abs(pointsRemaining)} pts over budget`}
                </span>
              </div>
              <div className="sc-traits">
                {TRAIT_KEYS.map((key) => (
                  <TraitSlider
                    key={key}
                    label={TRAIT_LABELS[key]}
                    description={TRAIT_DESCRIPTIONS[key]}
                    value={traits[key]}
                    min={1}
                    max={10}
                    onChange={(v) => handleTraitChange(key, v)}
                    overBudget={overBudget}
                  />
                ))}
              </div>
            </section>

            {/* Environment Preferences */}
            <section className="sc-section">
              <div className="sc-section__label">ENVIRONMENT PREFERENCES</div>

              <div className="sc-field">
                <div className="sc-env-row">
                  <label className="sc-field__label">Ideal Temperature</label>
                  <span className="sc-env-value">
                    {env.idealTemperature}K &mdash; {temperatureLabel(env.idealTemperature)}
                  </span>
                </div>
                <input
                  type="range"
                  min={150}
                  max={500}
                  value={env.idealTemperature}
                  onChange={(e) => setEnv((prev) => ({ ...prev, idealTemperature: Number(e.target.value) }))}
                  className="sc-range"
                />
                <div className="sc-range-labels">
                  <span>Frozen</span><span>Cold</span><span>Temperate</span><span>Warm</span><span>Scorching</span>
                </div>
              </div>

              <div className="sc-field">
                <div className="sc-env-row">
                  <label className="sc-field__label">Temperature Tolerance</label>
                  <span className="sc-env-value">&plusmn;{env.temperatureTolerance}K</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={100}
                  value={env.temperatureTolerance}
                  onChange={(e) => setEnv((prev) => ({ ...prev, temperatureTolerance: Number(e.target.value) }))}
                  className="sc-range"
                />
              </div>

              <div className="sc-field">
                <div className="sc-env-row">
                  <label className="sc-field__label">Ideal Gravity</label>
                  <span className="sc-env-value">{env.idealGravity.toFixed(1)}g</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={30}
                  value={Math.round(env.idealGravity * 10)}
                  onChange={(e) => setEnv((prev) => ({ ...prev, idealGravity: Number(e.target.value) / 10 }))}
                  className="sc-range"
                />
                <div className="sc-range-labels">
                  <span>0.1g</span><span>1.0g</span><span>2.0g</span><span>3.0g</span>
                </div>
              </div>

              <div className="sc-field">
                <div className="sc-env-row">
                  <label className="sc-field__label">Gravity Tolerance</label>
                  <span className="sc-env-value">&plusmn;{env.gravityTolerance.toFixed(1)}g</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={Math.round(env.gravityTolerance * 10)}
                  onChange={(e) => setEnv((prev) => ({ ...prev, gravityTolerance: Number(e.target.value) / 10 }))}
                  className="sc-range"
                />
              </div>

              <div className="sc-field">
                <label className="sc-field__label">Preferred Atmospheres</label>
                <div className="sc-atmosphere-grid">
                  {ATMOSPHERE_TYPES.map((atm) => {
                    const isChecked = env.preferredAtmospheres.includes(atm);
                    return (
                      <label
                        key={atm}
                        className={`sc-atm-check ${isChecked ? 'sc-atm-check--active' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleAtmosphereToggle(atm)}
                          className="sc-atm-checkbox"
                        />
                        {ATMOSPHERE_LABELS[atm]}
                      </label>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* Special Abilities */}
            <section className="sc-section">
              <div className="sc-section__label">SPECIAL ABILITIES <span className="sc-section__hint">(pick 0-2)</span></div>
              <AbilityPicker
                selected={abilities}
                maxSelected={2}
                onChange={setAbilities}
              />
            </section>

          </div>

          {/* -- Right column: preview -- */}
          <div className="species-creator__right">
            <div className="sc-preview">

              {/* Portrait */}
              <div className="sc-preview__portrait-area">
                <div className="sc-preview__portrait sc-preview__portrait--canvas">
                  {portraitUrl ? (
                    <img
                      src={portraitUrl}
                      alt={name.trim() || 'Species portrait'}
                      className="sc-preview__portrait-img"
                    />
                  ) : (
                    <div className="sc-preview__portrait-placeholder">
                      <span>{name.trim().charAt(0).toUpperCase() || '?'}</span>
                    </div>
                  )}
                  <div className="sc-preview__portrait-ring" />
                </div>
                <div className="sc-preview__name">{name.trim() || 'Unnamed Species'}</div>

                {/* Colour customisation pickers */}
                <div className="sc-portrait-colors">
                  <label className="sc-color-picker" title="Primary Colour">
                    <span className="sc-color-picker__label">Primary</span>
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="sc-color-picker__input"
                    />
                    <span className="sc-color-picker__swatch" style={{ background: primaryColor }} />
                  </label>
                  <label className="sc-color-picker" title="Secondary Colour">
                    <span className="sc-color-picker__label">Secondary</span>
                    <input
                      type="color"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="sc-color-picker__input"
                    />
                    <span className="sc-color-picker__swatch" style={{ background: secondaryColor }} />
                  </label>
                  <label className="sc-color-picker" title="Accent Colour">
                    <span className="sc-color-picker__label">Accent</span>
                    <input
                      type="color"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="sc-color-picker__input"
                    />
                    <span className="sc-color-picker__swatch" style={{ background: accentColor }} />
                  </label>
                </div>
              </div>

              {/* Trait chart */}
              <div className="sc-preview__section">
                <div className="sc-preview__section-label">TRAIT PROFILE</div>
                <div className="sc-trait-chart">
                  {TRAIT_KEYS.map((key) => {
                    const val = traits[key];
                    const pct = (val / 10) * 100;
                    const isTop = val === maxTraitVal;
                    return (
                      <div key={key} className="sc-trait-bar">
                        <span className="sc-trait-bar__label">{TRAIT_LABELS[key].slice(0, 4).toUpperCase()}</span>
                        <div className="sc-trait-bar__track">
                          <div
                            className="sc-trait-bar__fill"
                            style={{
                              width: `${pct}%`,
                              background: isTop ? 'var(--color-accent)' : 'rgba(0,180,220,0.5)',
                              boxShadow: isTop ? '0 0 8px var(--color-accent)' : 'none',
                            }}
                          />
                        </div>
                        <span className="sc-trait-bar__val">{val}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="sc-preview__budget-display">
                  Budget: {traitTotal}/{TRAIT_BUDGET}
                  {overBudget && <span className="sc-preview__over"> &mdash; OVER LIMIT</span>}
                </div>
              </div>

              {/* Environment summary */}
              <div className="sc-preview__section">
                <div className="sc-preview__section-label">HABITAT PREFERENCE</div>
                <div className="sc-preview__env-summary">
                  {habitabilityDescription(env)}
                </div>
                <div className="sc-preview__env-stats">
                  <div className="sc-preview__env-stat">
                    <span>Temperature</span>
                    <span>{env.idealTemperature}K &plusmn;{env.temperatureTolerance}</span>
                  </div>
                  <div className="sc-preview__env-stat">
                    <span>Gravity</span>
                    <span>{env.idealGravity.toFixed(1)}g &plusmn;{env.gravityTolerance.toFixed(1)}</span>
                  </div>
                </div>
              </div>

              {/* Special abilities */}
              {abilities.length > 0 && (
                <div className="sc-preview__section">
                  <div className="sc-preview__section-label">SPECIAL ABILITIES</div>
                  <div className="sc-preview__abilities">
                    {abilities.map((key) => {
                      const info = ABILITY_INFO.find((a) => a.key === key);
                      return info ? (
                        <div key={key} className="sc-preview__ability">
                          <span className="sc-preview__ability-icon">{info.icon}</span>
                          <span className="sc-preview__ability-name">{info.name}</span>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
              )}

              {/* Habitability preview */}
              <div className="sc-preview__section">
                <div className="sc-preview__section-label">HABITABILITY PREVIEW</div>
                <div className="sc-hab-grid">
                  {[
                    { type: 'Temperate', temp: 285, grav: 1.0 },
                    { type: 'Arctic', temp: 220, grav: 0.9 },
                    { type: 'Desert', temp: 370, grav: 1.1 },
                    { type: 'Ocean', temp: 290, grav: 1.0 },
                    { type: 'Gas Giant', temp: 160, grav: 2.5 },
                    { type: 'Volcanic', temp: 450, grav: 1.3 },
                  ].map(({ type, temp, grav }) => {
                    const tempOk = Math.abs(temp - env.idealTemperature) <= env.temperatureTolerance;
                    const gravOk = Math.abs(grav - env.idealGravity) <= env.gravityTolerance;
                    const habitable = tempOk && gravOk;
                    const partial = (tempOk || gravOk) && !habitable;
                    return (
                      <div
                        key={type}
                        className={`sc-hab-cell ${habitable ? 'sc-hab-cell--green' : partial ? 'sc-hab-cell--yellow' : 'sc-hab-cell--red'}`}
                      >
                        <span className="sc-hab-cell__icon">
                          {habitable ? '\u2713' : partial ? '~' : '\u2717'}
                        </span>
                        <span>{type}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Origin story note */}
              <div className="sc-preview__section">
                <div className="sc-preview__section-label">ORIGIN</div>
                <div className="sc-preview__origin-badge">{origin}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="species-creator__footer">
          <button type="button" className="sc-btn sc-btn--secondary" onClick={() => setMode('pick-race')}>
            &larr; Back to Races
          </button>
          <div className="sc-footer__center">
            <button type="button" className="sc-btn sc-btn--ghost" onClick={handleRandomize}>
              Randomise
            </button>
          </div>
          <button
            type="button"
            className={`sc-btn sc-btn--primary ${isValid ? '' : 'sc-btn--disabled'}`}
            onClick={handleStartGame}
            disabled={!isValid}
            title={!name.trim() ? 'Enter a species name' : overBudget ? 'Reduce trait points to fit budget' : ''}
          >
            Continue &rarr;
          </button>
        </div>
      </div>
    </div>
  );
}
