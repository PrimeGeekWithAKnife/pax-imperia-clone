import React, { useState, useCallback, useRef, useMemo } from 'react';
import type { Species, GalaxyShape, GovernmentType } from '@nova-imperia/shared';
import { GOVERNMENTS } from '@nova-imperia/shared';

// ── Types ──────────────────────────────────────────────────────────────────────

type GalaxySize = 'small' | 'medium' | 'large' | 'huge';
type AiDifficulty = 'easy' | 'normal' | 'hard';

export interface GameConfig {
  galaxySize: GalaxySize;
  galaxyShape: GalaxyShape;
  aiOpponents: number;
  seed: string;
  aiDifficulty: AiDifficulty;
  empireName: string;
  government: GovernmentType;
}

export interface GameSetupScreenProps {
  species: Species;
  originStory: string;
  /** Initial government suggested by the species creator. */
  governmentType: string;
  onBack: () => void;
  onStartGame: (config: GameConfig) => void;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const GALAXY_SIZES: Array<{ key: GalaxySize; label: string; systems: number; desc: string }> = [
  { key: 'small',  label: 'Small',  systems: 20,  desc: 'Quick game, 20 systems' },
  { key: 'medium', label: 'Medium', systems: 40,  desc: 'Standard, 40 systems'   },
  { key: 'large',  label: 'Large',  systems: 80,  desc: 'Epic scale, 80 systems' },
  { key: 'huge',   label: 'Huge',   systems: 120, desc: 'Marathon, 120 systems'  },
];

const GALAXY_SHAPES: Array<{ key: GalaxyShape; label: string; desc: string }> = [
  { key: 'spiral',      label: 'Spiral',      desc: 'Arms spreading from a dense core' },
  { key: 'elliptical',  label: 'Elliptical',  desc: 'Dense oval cluster of stars'      },
  { key: 'irregular',   label: 'Irregular',   desc: 'Chaotic, unpredictable layout'    },
  { key: 'ring',        label: 'Ring',        desc: 'Stars arranged in a great ring'   },
];

const DIFFICULTIES: Array<{ key: AiDifficulty; label: string; desc: string }> = [
  { key: 'easy',   label: 'Easy',   desc: 'AI is passive and makes suboptimal decisions' },
  { key: 'normal', label: 'Normal', desc: 'Balanced AI that plays to win'                },
  { key: 'hard',   label: 'Hard',   desc: 'Aggressive AI with economic bonuses'          },
];

const GOVERNMENT_ORDER: GovernmentType[] = [
  'forced_labour',
  'representative_democracy',
  'equality',
  'empire',
  'republic',
  'dictatorship',
];

// Maps the legacy SpeciesCreator government strings to our GovernmentType keys
const LEGACY_GOV_MAP: Record<string, GovernmentType> = {
  Democracy:        'representative_democracy',
  Autocracy:        'dictatorship',
  Theocracy:        'empire',
  Oligarchy:        'republic',
  'Hive Mind':      'equality',
  'Military Junta': 'dictatorship',
  Technocracy:      'representative_democracy',
  Federation:       'representative_democracy',
};

function resolveInitialGovernment(raw: string): GovernmentType {
  if (raw in GOVERNMENTS) return raw as GovernmentType;
  return LEGACY_GOV_MAP[raw] ?? 'representative_democracy';
}

// ── Galaxy shape SVG previews ──────────────────────────────────────────────────

function SpiralPreview(): React.ReactElement {
  return (
    <svg viewBox="0 0 60 60" width="54" height="54" aria-hidden="true">
      <circle cx="30" cy="30" r="4" fill="currentColor" opacity="0.9" />
      {[0,1,2,3,4,5,6,7,8].map((i) => {
        const angle = (i / 8) * Math.PI * 2;
        const r = 5 + i * 2.5;
        const x = 30 + Math.cos(angle) * r;
        const y = 30 + Math.sin(angle) * r;
        return <circle key={`a1-${i}`} cx={x} cy={y} r={1.2} fill="currentColor" opacity={0.7 - i * 0.06} />;
      })}
      {[0,1,2,3,4,5,6,7,8].map((i) => {
        const angle = Math.PI + (i / 8) * Math.PI * 2;
        const r = 5 + i * 2.5;
        const x = 30 + Math.cos(angle) * r;
        const y = 30 + Math.sin(angle) * r;
        return <circle key={`a2-${i}`} cx={x} cy={y} r={1.2} fill="currentColor" opacity={0.7 - i * 0.06} />;
      })}
    </svg>
  );
}

function EllipticalPreview(): React.ReactElement {
  const dots: Array<{ x: number; y: number; r: number }> = [];
  const rng = { v: 42 };
  function rand(): number { rng.v = (rng.v * 1664525 + 1013904223) & 0xffffffff; return (rng.v >>> 0) / 4294967296; }
  for (let i = 0; i < 30; i++) {
    const angle = rand() * Math.PI * 2;
    const d = rand() * 0.85;
    dots.push({ x: 30 + Math.cos(angle) * d * 22, y: 30 + Math.sin(angle) * d * 14, r: 1 + rand() * 0.8 });
  }
  return (
    <svg viewBox="0 0 60 60" width="54" height="54" aria-hidden="true">
      {dots.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={d.r} fill="currentColor" opacity={0.75} />)}
    </svg>
  );
}

function IrregularPreview(): React.ReactElement {
  const dots: Array<{ x: number; y: number; r: number }> = [];
  const rng = { v: 99 };
  function rand(): number { rng.v = (rng.v * 1664525 + 1013904223) & 0xffffffff; return (rng.v >>> 0) / 4294967296; }
  for (let i = 0; i < 28; i++) {
    dots.push({ x: 6 + rand() * 48, y: 6 + rand() * 48, r: 0.8 + rand() * 1.2 });
  }
  return (
    <svg viewBox="0 0 60 60" width="54" height="54" aria-hidden="true">
      {dots.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={d.r} fill="currentColor" opacity={0.75} />)}
    </svg>
  );
}

function RingPreview(): React.ReactElement {
  const count = 20;
  return (
    <svg viewBox="0 0 60 60" width="54" height="54" aria-hidden="true">
      <circle cx="30" cy="30" r="3" fill="currentColor" opacity="0.5" />
      {Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2;
        const jitter = ((i * 7919) % 5) - 2;
        const rx = 22 + jitter * 0.3;
        const ry = 22 + jitter * 0.3;
        return (
          <circle
            key={i}
            cx={30 + Math.cos(angle) * rx}
            cy={30 + Math.sin(angle) * ry}
            r={1.2}
            fill="currentColor"
            opacity={0.8}
          />
        );
      })}
    </svg>
  );
}

const SHAPE_PREVIEW_COMPONENTS: Record<GalaxyShape, () => React.ReactElement> = {
  spiral:     SpiralPreview,
  elliptical: EllipticalPreview,
  irregular:  IrregularPreview,
  ring:       RingPreview,
};

// ── Portrait helper ────────────────────────────────────────────────────────────

const PORTRAIT_COLORS = [
  '#1a4a6e', '#2d6b4a', '#6e1a4a', '#4a3d1a', '#1a4a4a',
  '#6e4a1a', '#2d2d6b', '#6b2d2d',
];

function portraitColor(name: string): string {
  const idx = name.charCodeAt(0) % PORTRAIT_COLORS.length;
  return PORTRAIT_COLORS[isNaN(idx) ? 0 : idx] ?? '#1a4a6e';
}

function emitToPhaser(eventName: string, data: unknown): void {
  const game = (window as unknown as Record<string, unknown>).__EX_NIHILO_GAME__ as
    | { events: { emit: (e: string, d: unknown) => void } }
    | undefined;
  game?.events.emit(eventName, data);
}

// ── Government modifier display helpers ────────────────────────────────────────

interface ModifierEntry {
  label: string;
  value: number;
  isPercent: boolean;
}

function getModifierEntries(govType: GovernmentType): ModifierEntry[] {
  const mods = GOVERNMENTS[govType]?.modifiers;
  if (!mods) return [];
  return [
    { label: 'Construction', value: mods.constructionSpeed, isPercent: true },
    { label: 'Research',     value: mods.researchSpeed,     isPercent: true },
    { label: 'Trade',        value: mods.tradeIncome,       isPercent: true },
    { label: 'Growth',       value: mods.populationGrowth,  isPercent: true },
    { label: 'Happiness',    value: mods.happiness,         isPercent: false },
    { label: 'Combat',       value: mods.combatBonus,       isPercent: true },
    { label: 'Build Cost',   value: mods.buildingCost,      isPercent: true },
  ];
}

function formatModifier(entry: ModifierEntry): string {
  if (entry.isPercent) {
    const pct = Math.round((entry.value - 1) * 100);
    return pct >= 0 ? `+${pct}%` : `${pct}%`;
  }
  return entry.value >= 0 ? `+${entry.value}` : String(entry.value);
}

function modifierIsPositive(entry: ModifierEntry): boolean {
  if (entry.label === 'Build Cost') {
    // Lower cost is better
    return entry.value < 1.0;
  }
  if (entry.isPercent) return entry.value > 1.0;
  return entry.value > 0;
}

function modifierIsNeutral(entry: ModifierEntry): boolean {
  if (entry.isPercent) return entry.value === 1.0;
  return entry.value === 0;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function GameSetupScreen({
  species,
  originStory,
  governmentType,
  onBack,
  onStartGame,
}: GameSetupScreenProps): React.ReactElement {
  const [galaxySize, setGalaxySize] = useState<GalaxySize>('medium');
  const [galaxyShape, setGalaxyShape] = useState<GalaxyShape>('spiral');
  const [aiOpponents, setAiOpponents] = useState(3);
  const [seed, setSeed] = useState('');
  const [aiDifficulty, setAiDifficulty] = useState<AiDifficulty>('normal');
  const [selectedGov, setSelectedGov] = useState<GovernmentType>(
    () => resolveInitialGovernment(governmentType),
  );
  const [empireName, setEmpireName] = useState(
    () => `${species.name} Dominion`,
  );

  const seedInputRef = useRef<HTMLInputElement>(null);

  const handleStartGame = useCallback(() => {
    const resolvedSeed = seed.trim() || String(Math.floor(Math.random() * 0xffffff));
    const resolvedName = empireName.trim() || `${species.name} Dominion`;
    const config: GameConfig = {
      galaxySize,
      galaxyShape,
      aiOpponents,
      seed: resolvedSeed,
      aiDifficulty,
      empireName: resolvedName,
      government: selectedGov,
    };
    emitToPhaser('game:start_with_config', { species, config });
    onStartGame(config);
  }, [galaxySize, galaxyShape, aiOpponents, seed, aiDifficulty, species, selectedGov, empireName, onStartGame]);

  const handleRandomSeed = useCallback(() => {
    const newSeed = String(Math.floor(Math.random() * 0xffffff));
    setSeed(newSeed);
    seedInputRef.current?.focus();
  }, []);

  const traitKeys = Object.keys(species.traits) as Array<keyof typeof species.traits>;
  const maxTrait = Math.max(...traitKeys.map((k) => species.traits[k]));

  const selectedGovDef = GOVERNMENTS[selectedGov];
  const modifiers = useMemo(() => getModifierEntries(selectedGov), [selectedGov]);
  const notableModifiers = useMemo(
    () => modifiers.filter((m) => !modifierIsNeutral(m)).slice(0, 4),
    [modifiers],
  );

  return (
    <div className="game-setup-overlay">
      <div className="game-setup">

        {/* Header */}
        <div className="game-setup__header">
          <div className="game-setup__title">GAME SETUP</div>
          <div className="game-setup__subtitle">Configure your empire and galaxy before launch</div>
        </div>

        {/* Body: two columns */}
        <div className="game-setup__body">

          {/* ── Left: config controls ─────────────────────────────────── */}
          <div className="game-setup__left">

            {/* Empire Name */}
            <section className="sc-section">
              <div className="sc-section__label">EMPIRE NAME</div>
              <input
                type="text"
                className="sc-input gs-empire-name-input"
                placeholder={`${species.name} Dominion`}
                value={empireName}
                onChange={(e) => setEmpireName(e.target.value)}
                maxLength={48}
                aria-label="Empire name"
              />
            </section>

            {/* Government */}
            <section className="sc-section">
              <div className="sc-section__label">GOVERNMENT</div>
              <div className="gs-gov-grid">
                {GOVERNMENT_ORDER.map((govKey) => {
                  const def = GOVERNMENTS[govKey];
                  return (
                    <button
                      key={govKey}
                      type="button"
                      className={`gs-gov-card ${selectedGov === govKey ? 'gs-gov-card--active' : ''}`}
                      onClick={() => setSelectedGov(govKey)}
                      title={def.description}
                    >
                      <span className="gs-gov-card__name">{def.name}</span>
                    </button>
                  );
                })}
              </div>
              {selectedGovDef && (
                <div className="gs-gov-detail">
                  <div className="gs-gov-detail__desc">{selectedGovDef.description}</div>
                  <div className="gs-gov-detail__mods">
                    {modifiers.map((entry) => {
                      const positive = modifierIsPositive(entry);
                      const neutral = modifierIsNeutral(entry);
                      const colorClass = neutral
                        ? 'gs-mod--neutral'
                        : positive
                          ? 'gs-mod--positive'
                          : 'gs-mod--negative';
                      return (
                        <span key={entry.label} className={`gs-mod ${colorClass}`}>
                          <span className="gs-mod__label">{entry.label}</span>
                          <span className="gs-mod__value">{formatModifier(entry)}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>

            {/* Galaxy Size */}
            <section className="sc-section">
              <div className="sc-section__label">GALAXY SIZE</div>
              <div className="gs-size-grid">
                {GALAXY_SIZES.map(({ key, label, systems, desc }) => (
                  <button
                    key={key}
                    type="button"
                    className={`gs-size-card ${galaxySize === key ? 'gs-size-card--active' : ''}`}
                    onClick={() => setGalaxySize(key)}
                    title={desc}
                  >
                    <span className="gs-size-card__label">{label}</span>
                    <span className="gs-size-card__systems">{systems}</span>
                    <span className="gs-size-card__unit">systems</span>
                  </button>
                ))}
              </div>
            </section>

            {/* Galaxy Shape */}
            <section className="sc-section">
              <div className="sc-section__label">GALAXY SHAPE</div>
              <div className="gs-shape-grid">
                {GALAXY_SHAPES.map(({ key, label, desc }) => {
                  const Preview = SHAPE_PREVIEW_COMPONENTS[key];
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`gs-shape-card ${galaxyShape === key ? 'gs-shape-card--active' : ''}`}
                      onClick={() => setGalaxyShape(key)}
                      title={desc}
                    >
                      <div className="gs-shape-card__preview">
                        <Preview />
                      </div>
                      <span className="gs-shape-card__label">{label}</span>
                      <span className="gs-shape-card__desc">{desc}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* AI Opponents */}
            <section className="sc-section">
              <div className="sc-section__label-row">
                <span className="sc-section__label">AI OPPONENTS</span>
                <span className="gs-slider-value">{aiOpponents} empire{aiOpponents !== 1 ? 's' : ''}</span>
              </div>
              <input
                type="range"
                min={1}
                max={7}
                value={aiOpponents}
                onChange={(e) => setAiOpponents(Number(e.target.value))}
                className="sc-range gs-range"
              />
              <div className="sc-range-labels">
                <span>1</span>
                <span>2</span>
                <span>3</span>
                <span>4</span>
                <span>5</span>
                <span>6</span>
                <span>7</span>
              </div>
            </section>

            {/* AI Difficulty */}
            <section className="sc-section">
              <div className="sc-section__label">AI DIFFICULTY</div>
              <div className="gs-diff-grid">
                {DIFFICULTIES.map(({ key, label, desc }) => (
                  <button
                    key={key}
                    type="button"
                    className={`gs-diff-btn ${aiDifficulty === key ? 'gs-diff-btn--active' : ''}`}
                    onClick={() => setAiDifficulty(key)}
                    title={desc}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="gs-diff-desc">
                {DIFFICULTIES.find((d) => d.key === aiDifficulty)?.desc}
              </div>
            </section>

            {/* Galaxy Seed */}
            <section className="sc-section">
              <div className="sc-section__label">GALAXY SEED <span className="sc-section__hint">(optional)</span></div>
              <div className="gs-seed-row">
                <input
                  ref={seedInputRef}
                  type="text"
                  className="sc-input gs-seed-input"
                  placeholder="Leave empty to randomize..."
                  value={seed}
                  onChange={(e) => setSeed(e.target.value)}
                  maxLength={32}
                />
                <button
                  type="button"
                  className="sc-btn sc-btn--ghost gs-seed-btn"
                  onClick={handleRandomSeed}
                  title="Generate a random seed"
                >
                  ⚄ Random
                </button>
              </div>
              <div className="gs-seed-hint">
                Same seed + same settings produces an identical galaxy. Share with friends for a fair match.
              </div>
            </section>

          </div>

          {/* ── Right: empire summary ─────────────────────────────────── */}
          <div className="game-setup__right">
            <div className="gs-summary">
              <div className="gs-summary__heading">YOUR EMPIRE</div>

              {/* Portrait */}
              <div className="gs-summary__portrait-area">
                <div
                  className="gs-summary__portrait"
                  style={{
                    background: `radial-gradient(circle at 35% 35%, ${portraitColor(species.name)}cc, #05050f)`,
                  }}
                >
                  <span className="gs-summary__portrait-initial">
                    {(empireName.trim() || species.name).trim().charAt(0).toUpperCase() || '?'}
                  </span>
                  <div className="gs-summary__portrait-ring" />
                </div>
                <div className="gs-summary__empire-name">
                  {empireName.trim() || `${species.name} Dominion`}
                </div>
                <div className="gs-summary__species-name">{species.name}</div>
                <div className="gs-summary__gov-badge">{selectedGovDef?.name ?? governmentType}</div>
              </div>

              {/* Government key stats */}
              {notableModifiers.length > 0 && (
                <div className="gs-summary__section">
                  <div className="gs-summary__section-label">GOVERNMENT EFFECTS</div>
                  <div className="gs-gov-summary-mods">
                    {notableModifiers.map((entry) => {
                      const positive = modifierIsPositive(entry);
                      const colorClass = positive ? 'gs-mod--positive' : 'gs-mod--negative';
                      return (
                        <span key={entry.label} className={`gs-mod ${colorClass}`}>
                          <span className="gs-mod__label">{entry.label}</span>
                          <span className="gs-mod__value">{formatModifier(entry)}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Trait bars */}
              <div className="gs-summary__section">
                <div className="gs-summary__section-label">TRAIT PROFILE</div>
                <div className="gs-trait-chart">
                  {traitKeys.map((key) => {
                    const val = species.traits[key];
                    const pct = (val / 10) * 100;
                    const isTop = val === maxTrait;
                    return (
                      <div key={key} className="sc-trait-bar">
                        <span className="sc-trait-bar__label">
                          {key.slice(0, 4).toUpperCase()}
                        </span>
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
              </div>

              {/* Special abilities */}
              {species.specialAbilities.length > 0 && (
                <div className="gs-summary__section">
                  <div className="gs-summary__section-label">SPECIAL ABILITIES</div>
                  <div className="gs-summary__abilities">
                    {species.specialAbilities.map((ab) => (
                      <span key={ab} className="gs-summary__ability-tag">{ab}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Origin */}
              <div className="gs-summary__section">
                <div className="gs-summary__section-label">ORIGIN</div>
                <div className="gs-summary__origin-badge">{originStory}</div>
              </div>

              {/* Description */}
              {species.description && (
                <div className="gs-summary__section">
                  <div className="gs-summary__section-label">LORE</div>
                  <div className="gs-summary__desc">{species.description}</div>
                </div>
              )}

              {/* Config preview */}
              <div className="gs-summary__section gs-config-preview">
                <div className="gs-summary__section-label">GALAXY PREVIEW</div>
                <div className="gs-config-row">
                  <span className="gs-config-key">Size</span>
                  <span className="gs-config-val">
                    {GALAXY_SIZES.find((s) => s.key === galaxySize)?.label} ({GALAXY_SIZES.find((s) => s.key === galaxySize)?.systems} systems)
                  </span>
                </div>
                <div className="gs-config-row">
                  <span className="gs-config-key">Shape</span>
                  <span className="gs-config-val">
                    {GALAXY_SHAPES.find((s) => s.key === galaxyShape)?.label}
                  </span>
                </div>
                <div className="gs-config-row">
                  <span className="gs-config-key">Opponents</span>
                  <span className="gs-config-val">{aiOpponents} AI empire{aiOpponents !== 1 ? 's' : ''}</span>
                </div>
                <div className="gs-config-row">
                  <span className="gs-config-key">Difficulty</span>
                  <span className="gs-config-val" style={{ textTransform: 'capitalize' }}>{aiDifficulty}</span>
                </div>
                <div className="gs-config-row">
                  <span className="gs-config-key">Seed</span>
                  <span className="gs-config-val gs-config-val--muted">{seed.trim() || '(auto)'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="game-setup__footer">
          <button type="button" className="sc-btn sc-btn--secondary" onClick={onBack}>
            ← Back
          </button>
          <button
            type="button"
            className="sc-btn sc-btn--primary"
            onClick={handleStartGame}
          >
            Start Game →
          </button>
        </div>

      </div>
    </div>
  );
}
