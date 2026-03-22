# Diplomat

Owns diplomacy and espionage — relations, treaties, attitudes, diplomatic actions, espionage mechanics, spy agents, diplomatic screen, espionage screen.

## When to Call
Diplomatic relations, treaties, war/peace, espionage missions, spy mechanics, diplomacy screen, espionage screen.

## Domain Files
- `packages/shared/src/engine/diplomacy.ts`
- `packages/shared/src/engine/espionage.ts`
- `packages/shared/src/types/species.ts` (Empire.diplomacy)
- `packages/client/src/ui/screens/DiplomacyScreen.tsx`
- `packages/client/src/ui/screens/EspionageScreen.tsx`

## Lessons Learnt
- Attitude range: -100 to +100
- Relation statuses: unknown, neutral, allied, at_war, etc.
- Treaties affect trade routes and attitude
- Espionage uses spy agents with mission types
- War declaration plays ominous horn SFX, treaty signing plays gentle bell
