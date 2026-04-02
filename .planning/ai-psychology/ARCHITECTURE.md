# AI Species Psychology & Diplomacy System — Architecture

> **Purpose:** Replace the flat attitude/trust diplomacy model with a deep,
> probabilistic personality-driven system grounded in validated psychology.
> Each species feels distinct, relationships evolve organically, and no two
> playthroughs play the same.

## Design Principles

1. **Probabilistic, not deterministic** — moods, decisions, and reactions are
   weighted rolls, not threshold gates. A 90% angry species might still show
   restraint; a 10% angry one might snap.
2. **Discoverable, not displayed** — players learn species personalities through
   behaviour, not stat sheets. No mood bars or personality readouts.
3. **Variation per playthrough** — species have a personality SPECTRUM. Each game
   rolls within that spectrum. Difficulty shifts the distribution unfavourably.
4. **Maslow overrides everything** — a starving species will betray its best
   ally. Survival cuts through personality.
5. **Context-driven mood shifts** — events trigger mood changes at rates
   determined by attachment style. No arbitrary timers.

---

## Phase Sequencing

```
Phase 1: Species Personality Data Layer
  └─ Big Five + H traits, attachment styles, Enneagram, per-species vectors
  └─ Personality spectrum + difficulty scaling
  └─ Species-pair affinity matrix (static foundation)

Phase 2: Mood & Psychological State Engine
  └─ Maslow need tracking (5 levels, lowest unmet drives behaviour)
  └─ Mood state (multi-dimensional, not single axis)
  └─ Stress escalation model (5 levels from document)
  └─ Attachment-style-driven mood volatility

Phase 3: Relationship Model Overhaul
  └─ Replace flat attitude/trust with multi-dimensional relationship state
  └─ Per-pair relationship memory (events, incidents, patterns)
  └─ Dynamic affinity evolution (static base + event-driven shifts)
  └─ Compatibility computation (weighted trait similarity)

Phase 4: Diplomacy Decision Engine
  └─ Personality-driven treaty evaluation (probabilistic)
  └─ Attachment-style-driven proposal frequency and response patterns
  └─ Need-based diplomacy (what does this species WANT from this relation?)
  └─ Expanded diplomatic actions (praise, gifts, recognition, gestures)

Phase 5: AI Behaviour Integration
  └─ Wire psychology into war/peace/build/expand decisions
  └─ Stress-responsive personality state shifts
  └─ Dark Triad behaviours for appropriate species
  └─ Personality evolution through game events (memory-driven trait drift)

Phase 6: Galactic Senate (separate feature, depends on Phase 4)
  └─ Membership, voting, leadership, senate actions as diplomatic tools
```

---

## Phase 1: Species Personality Data Layer

### 1.1 Trait Model

Each species has a **personality vector** consisting of:

**Core Dimensions (6 — Big Five + Honesty-Humility from HEXACO):**

| Dimension | Code | What it predicts |
|---|---|---|
| Neuroticism | N | Emotional reactivity, anxiety, mood swings, anger-in |
| Extraversion | E | Social initiative, alliance breadth, attention-seeking |
| Openness | O | Curiosity, tolerance, unconventionality, moral universalism |
| Agreeableness | A | Cooperation, trust, forgiveness, conflict avoidance |
| Conscientiousness | C | Reliability, planning, follow-through, loyalty |
| Honesty-Humility | H | Fairness, sincerity, exploitation resistance |

Each dimension scored **0-100** with species-specific **median** and **standard deviation**.

**Key Subfacets (2-5 per species, selected to define distinctive personality):**

Complex species (e.g., Teranos, Vethara) get 4-5 subfacets.
Simpler species (e.g., Zorvathi hive mind) get 2-3.

Example subfacets: Anxiety (N), Anger-Hostility (N), Warmth (E), Assertiveness (E),
Trust (A), Compliance (A), Deliberation (C), Achievement-Striving (C).

### 1.2 Attachment Style

Each species has an **attachment style** that governs relationship dynamics:

| Style | Anxiety | Avoidance | Behaviour Pattern |
|---|---|---|---|
| Secure | Low | Low | Stable relationships, proportionate reactions, trust repair |
| Anxious-Preoccupied | High | Low | Clingy, needs validation, panic when allies distant, quick mood shifts |
| Dismissive-Avoidant | Low | High | Self-reliant, resists deep bonds, slow cold reactions, remembers slights |
| Fearful-Avoidant | High | High | Wants connection but fears it, approach-avoidance cycles, turbulent moods |

Attachment style is derived from N (→ anxiety axis) and A+E inverse (→ avoidance axis)
but can be overridden per species for thematic fit.

### 1.3 Enneagram Type

Each species has a primary Enneagram type (1-9) that provides:
- **Core fear** and **core desire** (motivation drivers)
- **Stress direction** (which type they shift toward under pressure)
- **Growth direction** (which type they shift toward when thriving)
- **Wing** (secondary flavour)

This creates a state machine for dramatic personality shifts under stress.

### 1.4 Per-Species Personality Vectors

```typescript
interface SpeciesPersonality {
  // Core Big Five + H dimensions: { median, stddev } for per-game rolling
  traits: {
    neuroticism:      { median: number; stddev: number };
    extraversion:     { median: number; stddev: number };
    openness:         { median: number; stddev: number };
    agreeableness:    { median: number; stddev: number };
    conscientiousness:{ median: number; stddev: number };
    honestyHumility:  { median: number; stddev: number };
  };

  // Selected subfacets that define this species' distinctive personality
  subfacets: Record<string, { median: number; stddev: number }>;

  // Attachment style (can be overridden from trait-derived default)
  attachmentStyle: 'secure' | 'anxious' | 'avoidant' | 'fearful_avoidant';

  // Enneagram type for stress/growth state machine
  enneagramType: number;  // 1-9
  enneagramWing: number;  // adjacent type

  // Dark Triad scores (0-100, most species low)
  darkTriad: {
    narcissism: number;     // grandiose vs vulnerable split via N
    machiavellianism: number;
    psychopathy: number;
    sadism: number;         // Dark Tetrad extension
  };

  // Moral foundations weights (drive faction-level values)
  moralFoundations: {
    careHarm: number;           // 0-100
    fairnessCheating: number;
    loyaltyBetrayal: number;
    authoritySubversion: number;
    sanctityDegradation: number;
    libertyOppression: number;
  };

  // First-contact attitude range (rolled per game)
  firstContactAttitude: { min: number; max: number };  // e.g. Teranos: { min: 5, max: 25 }
}
```

### 1.5 Proposed Species Assignments

| Species | N | E | O | A | C | H | Attach | Enneagram | Dark Triad | Theme |
|---|---|---|---|---|---|---|---|---|---|---|
| Teranos | 50 | 60 | 70 | 55 | 50 | 50 | Secure | 7w6 | Low | Adaptable optimists |
| Khazari | 30 | 35 | 20 | 25 | 85 | 40 | Avoidant | 8w9 | Mod Narc | Stubborn honour-bound smiths |
| Drakmari | 60 | 55 | 30 | 20 | 45 | 25 | Fearful-Avoidant | 8w7 | High Psych+Sadism | Predatory hunters |
| Sylvani | 20 | 40 | 80 | 75 | 60 | 80 | Secure | 9w1 | Nil | Patient botanical network |
| Nexari | 15 | 70 | 65 | 30 | 90 | 35 | Avoidant | 3w2 | Mod Mach | Assimilating hive mind |
| Orivani | 55 | 65 | 15 | 40 | 80 | 45 | Anxious | 1w2 | Mod Narc | Zealous crusaders |
| Pyrenth | 10 | 10 | 40 | 35 | 95 | 70 | Avoidant | 5w4 | Nil | Glacial crystal masons |
| Luminari | 25 | 50 | 90 | 70 | 30 | 75 | Secure | 5w4 | Nil | Curious energy observers |
| Vethara | 75 | 60 | 55 | 65 | 40 | 50 | Anxious | 2w3 | Low Mach | Desperate symbiotic parasites |
| Ashkari | 55 | 50 | 60 | 50 | 55 | 55 | Anxious | 6w7 | Low | Pragmatic refugee survivors |
| Zorvathi | 20 | 20 | 15 | 60 | 80 | 60 | Avoidant | 9w8 | Nil | Subterranean hive (simple) |
| Kaelenth | 10 | 15 | 75 | 15 | 95 | 30 | Avoidant | 5w6 | High Mach | Cold analytical machines |
| Thyriaq | 40 | 30 | 50 | 25 | 70 | 20 | Fearful-Avoidant | 5w4 | Mod Psych | Nanomorphic matter-analysers |
| Aethyn | 30 | 45 | 95 | 55 | 35 | 65 | Secure | 4w5 | Nil | Interdimensional pioneers |
| Vaelori | 35 | 30 | 70 | 60 | 50 | 70 | Secure | 5w4 | Nil | Psychic crystal prophets |

### 1.6 Difficulty Scaling

Per-game personality is rolled from `clamp(gaussian(median, stddev), 0, 100)`.

Difficulty shifts the distribution:
- **Easy:** +10 to A, +10 to H, -10 to N, -10 to Dark Triad → friendlier AI
- **Normal:** baseline medians
- **Hard:** -10 to A, -10 to H, +10 to N, +10 to Dark Triad → more hostile, less trustworthy
- **Brutal:** -20 to A, +20 to N, Dark Triad doubled → paranoid, exploitative AI

### 1.7 Species-Pair Affinity Matrix

A 15x15 matrix of **base affinity modifiers** (-50 to +50) representing inherent
species-pair chemistry. This is the STATIC foundation; actual relationships evolve
from here based on events.

Examples:
- Khazari ↔ Pyrenth: +30 (silicon kindred spirits, shared forge culture)
- Drakmari ↔ Vethara: -20 (predator vs parasite, mutual suspicion)
- Teranos ↔ Luminari: +15 (human fascination with energy beings)
- Nexari ↔ everyone: -10 (the "Gift" is creepy)
- Sylvani ↔ Luminari: +25 (photosynthetic meets energy form, philosophical kinship)

This matrix is modified at runtime by:
- Language/cultural learning (improves over contact time)
- Observed behaviour (enslaving others → penalty with high-A species)
- Shared enemies (common threat bonus)
- Treaty history (broken treaties → permanent scar)

---

## Phase 2: Mood & Psychological State Engine

### 2.1 Maslow Need Hierarchy

Each empire tracks 5 need levels. The **lowest unmet need** dominates behaviour
and can override personality-driven decisions.

```typescript
interface MaslowNeeds {
  physiological: number;  // 0-100: food, energy, basic resources
  safety: number;         // 0-100: military security, territorial integrity
  belonging: number;      // 0-100: alliances, trade partners, cultural exchange
  esteem: number;         // 0-100: galactic recognition, technological prestige
  selfActualisation: number; // 0-100: victory progress, expansion, research
}
```

**Override rules:**
- Physiological < 30 → ignore all personality, pursue survival (betray allies for food)
- Safety < 30 → military decisions override diplomatic personality
- Belonging < 30 → anxious types panic; avoidant types withdraw further
- Needs update every tick based on empire state (resources, territory, relations)

### 2.2 Mood State

Mood is **multi-dimensional**, not a single happy/angry axis:

```typescript
interface MoodState {
  valence: number;      // -100 to +100: negative ↔ positive overall feeling
  arousal: number;      // 0-100: calm ↔ agitated (high arousal = more extreme actions)
  dominance: number;    // 0-100: submissive ↔ dominant (affects negotiation stance)
  anxiety: number;      // 0-100: relaxed ↔ panicked (attachment anxiety amplifier)
  anger: number;        // 0-100: calm ↔ furious (separate from valence for grudges)
}
```

### 2.3 Mood Volatility by Attachment Style

| Style | Shift Rate | Decay Rate | Trigger Threshold | Pattern |
|---|---|---|---|---|
| Secure | Moderate | Moderate | High (takes a lot to shift) | Smooth, proportionate |
| Anxious | Fast | Slow (rumination) | Low (small events shift mood) | Spiky, recency bias |
| Avoidant | Glacial | Very slow | High (appears unaffected) | Delayed then sudden cold shift |
| Fearful-Avoidant | Semi-random | Irregular | Random (100-300 tick cycles) | Turbulent, unpredictable |

### 2.4 Stress Escalation (from document)

5-level model mapped to gameplay:

| Level | Trigger | Effect |
|---|---|---|
| 1 Baseline | No threats | Personality operates normally |
| 2 Moderate | Border tension, resource pressure | Coping strategies activate by type |
| 3 High | Active war, starvation | Personality shifts toward lower functioning |
| 4 Extreme | Home world threatened, multiple wars | Fight/flight/freeze/fawn cascade |
| 5 Recovery | After crisis resolves | Rebuild, post-traumatic growth possible |

Enneagram disintegration: under stress level 3+, species shift toward their
stress type (e.g., Type 9 Sylvani → Type 6 anxiety, Type 8 Khazari → Type 5
withdrawal).

---

## Phase 3: Relationship Model Overhaul

### 3.1 Relationship State (replaces flat attitude/trust)

```typescript
interface Relationship {
  // Core dimensions (replace single attitude + trust)
  warmth: number;         // -100 to +100: coldness ↔ affection
  respect: number;        // -100 to +100: contempt ↔ admiration
  trust: number;          // 0-100: suspicion ↔ confidence
  fear: number;           // 0-100: indifferent ↔ terrified
  dependency: number;     // 0-100: self-sufficient ↔ deeply reliant

  // Derived from personality interaction
  compatibility: number;  // -100 to +100: computed from trait similarity
  dynamicAffinity: number;// modifier on top of static species-pair affinity

  // Memory
  incidents: RelationshipIncident[];  // timestamped events that shaped this
  grievances: Grievance[];            // unresolved wrongs (grudge system)
  positiveHistory: number;            // accumulated positive interactions
  negativeHistory: number;            // accumulated negative interactions

  // Attachment-specific
  lastContactTick: number;            // when we last interacted
  contactFrequency: number;           // rolling average of interactions/epoch
  abandonmentAnxiety: number;         // for anxious types: rises when contact drops
}
```

### 3.2 Compatibility Computation

```
compatibility(A, B) =
  (1 - |A.N - B.N| / 100) * 0.29 +   // N similarity (most important)
  (1 - |A.A - B.A| / 100) * 0.29 +   // A similarity
  (1 - |A.C - B.C| / 100) * 0.25 +   // C similarity
  (1 - |A.E - B.E| / 100) * 0.17 +   // E similarity
  (1 - |A.O - B.O| / 100) * 0.10 -   // O similarity
  darkTriadPenalty(A, B)              // DT traits in either party
```

Scaled to -100..+100 range. Added to species-pair static affinity.

### 3.3 Relationship Evolution

Events modify relationship dimensions:

| Event | warmth | respect | trust | fear |
|---|---|---|---|---|
| Trade treaty signed | +5 | +3 | +5 | 0 |
| Gift received | +8 | +2 | +3 | 0 |
| Praise/recognition | +3 | +5 | +1 | 0 |
| Treaty broken | -20 | -15 | -30 | +5 |
| War declared on us | -30 | -10 | -40 | +20 |
| Defended us in war | +15 | +20 | +25 | -5 |
| Conquered a friend | -10 | -5 | -15 | +15 |
| Enslaved a species | -25 (high-A) | -20 | -20 | +10 |
| Ignored our request | varies by attachment style | | | |

Attachment modifiers on event impact:
- Anxious: 2x impact on warmth, 3x on abandonment from being ignored
- Avoidant: 0.5x immediate impact, but grievances accumulate silently
- Fearful-avoidant: 1.5x impact but oscillating sign (overreaction then reversal)
- Secure: 1x impact, fastest decay of negative events

---

## Phase 4: Diplomacy Decision Engine

### 4.1 Probabilistic Decision Model

Replace threshold gates with probability rolls:

```
P(accept_treaty) = sigmoid(
  relationship.warmth * 0.3 +
  relationship.trust * 0.3 +
  need_alignment * 0.2 +
  personality_modifier * 0.1 +
  mood.valence * 0.1 +
  noise(attachment_volatility)
)
```

A species with warmth 80 and trust 70 has ~90% chance of accepting, not 100%.
A species with warmth 20 and trust 30 has ~15% chance — unlikely but possible
on a good day.

### 4.2 Expanded Diplomatic Actions

New actions beyond treaties:

| Action | Effect | Cost | Personality fit |
|---|---|---|---|
| Give Praise | +warmth, +respect to target | Free (cooldown) | High-E initiator |
| Give Recognition | +respect, +esteem need | Free | Satisfies narcissistic need |
| Send Gift | +warmth, +trust | Credits/resources | Universal goodwill |
| Grand Gesture | Large +warmth/respect | Expensive | Dramatic, impresses anxious types |
| Insult | -warmth, -respect, +fear | Free | Dominance assertion |
| Threaten | +fear, -warmth | Fleet required | Coercive power |
| Cultural Exchange | +openness, +compatibility over time | Research points | High-O types benefit most |
| Galactic Senate Vote | +respect, +loyalty | Political capital | See Phase 6 |

### 4.3 Need-Based Diplomacy

Each species' Maslow needs generate **diplomatic desires**:

- Khazari (safety high, belonging low): "Leave me alone, trade minerals"
- Vethara (belonging critical): "I need partners NOW, will accept anything"
- Teranos (esteem + self-actualisation): "Build a federation, share technology"
- Drakmari (physiological + dominance): "Give me food-rich worlds or I take them"

The AI evaluates: "What does my species NEED from this relationship?"
and "What can this partner provide?" before proposing actions.

---

## Phase 5: AI Behaviour Integration

### 5.1 Decision Pipeline

```
1. Update Maslow needs from empire state
2. Update mood from recent events + attachment volatility
3. Check stress level → apply personality state shifts if needed
4. For each known empire:
   a. Update relationship from recent events
   b. Compute: what do we need? what can they offer?
   c. Generate diplomatic actions (probabilistic, personality-weighted)
5. Military decisions filtered through current mood + personality
6. Building decisions filtered through Maslow priorities
7. Personality drift from accumulated experiences
```

### 5.2 Personality Evolution

Traits shift slowly over time based on experiences:

```
trait_new = clamp(
  trait_old + sum(event_impact_i * e^(-decay * ticks_since_event)),
  species_min,
  species_max
)
```

A species that is repeatedly betrayed becomes less agreeable over time.
A species that forms successful alliances becomes more extraverted.
Major events (genocide, salvation from extinction) cause permanent shifts.

---

## Phase 6: Galactic Senate (separate feature)

### 6.1 Structure

- **Membership:** requires approval vote from existing members
- **Leadership:** elected by members, term-limited, confers prestige + esteem
- **Voting:** on resolutions (sanctions, trade agreements, war authorisation)
- **Actions:** propose resolution, vote, support/oppose candidacy, veto

### 6.2 Diplomatic Integration

Senate actions become diplomatic tools:
- Voting for someone's membership → +respect, +warmth
- Blocking membership → -warmth, -respect, potential war casus belli
- Supporting for leadership → large +respect, +loyalty
- Proposing sanctions against an aggressor → rallies coalition

---

## File Structure

```
packages/shared/
  data/
    species/
      personality/           # NEW: per-species personality vectors
        teranos.json
        khazari.json
        ... (15 files)
      affinity-matrix.json   # NEW: 15x15 species-pair base affinities

  src/
    types/
      psychology.ts          # NEW: all psychology type definitions
      diplomacy-v2.ts        # NEW: new relationship + diplomacy types

    engine/
      psychology/            # NEW: psychology engine directory
        personality.ts       # Personality vector operations, rolling, difficulty
        mood.ts              # Mood state machine, volatility, shifts
        maslow.ts            # Need hierarchy tracking and override logic
        stress.ts            # 5-level stress model, Enneagram disintegration
        compatibility.ts     # Trait similarity, pair affinity, relationship scoring

      diplomacy-v2/          # NEW: replacement diplomacy engine
        relationship.ts      # Relationship state, memory, evolution
        evaluation.ts        # Probabilistic treaty/action evaluation
        actions.ts           # Expanded diplomatic action catalogue
        ai-diplomacy.ts      # AI diplomatic decision generation

      ai.ts                  # MODIFY: wire psychology into existing AI decisions
      game-loop.ts           # MODIFY: add psychology tick processing
      game-init.ts           # MODIFY: roll per-game personalities at start

    __tests__/
      psychology/            # NEW: comprehensive test suite
        personality.test.ts
        mood.test.ts
        maslow.test.ts
        compatibility.test.ts
        relationship.test.ts
        integration.test.ts  # Full game simulation with psychology
```

---

## Implementation Order

Each phase produces working, testable software independently:

1. **Phase 1** (~2 sessions): Data files + types + personality rolling + tests
2. **Phase 2** (~2 sessions): Mood engine + Maslow + stress model + tests
3. **Phase 3** (~2 sessions): Relationship model + compatibility + memory + tests
4. **Phase 4** (~2 sessions): Diplomacy engine + expanded actions + tests
5. **Phase 5** (~2 sessions): AI integration + personality evolution + full playtest
6. **Phase 6** (~2 sessions): Galactic Senate (separate feature)

Total estimate: ~12 focused sessions. Each phase has its own detailed plan
written at the start of that phase's implementation.

---

## Key Technical Decisions

1. **Personality data is JSON** — moddable, like all other game data
2. **Psychology runs per-tick** — but most calculations are O(empires^2) which
   is negligible compared to combat/pathfinding
3. **Backward compatible** — old saves without psychology data get default
   personality vectors assigned on load
4. **No UI for personality** — behaviour IS the interface. Players learn species
   through interaction, not stat screens.
5. **Probabilistic core** — every decision includes a random component weighted
   by personality. This creates variation without feeling random.
