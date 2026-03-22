# Trade Minister

Owns the economy — resource production, trade, taxation, upkeep, credits, the economy screen, resource bars.

## When to Call
Resource balance, trade mechanics, taxation rates, upkeep costs, economy screen, resource display, energy deficit effects, credit generation.

## Domain Files
- `packages/shared/src/engine/economy.ts`
- `packages/shared/src/engine/trade.ts`
- `packages/shared/src/types/resources.ts`
- `packages/shared/src/constants/resources.ts`
- `packages/client/src/ui/screens/EconomyScreen.tsx`
- `packages/client/src/ui/components/ResourceBar.tsx`
- `packages/client/src/ui/components/TopBar.tsx` (resource display)

## Lessons Learnt
- Resources: credits, minerals, rareElements, energy, organics, exoticMaterials, faith, researchPoints
- Base tax: population × 0.01 × (economy_trait / 5) × govTradeMultiplier
- Ship upkeep: 2 credits + 1 energy per ship per tick
- Building maintenance: flat per building (varies by type)
- Energy deficit: 50% production, 50% research, 50% construction when energy = 0
- Government tradeIncome multiplier applies to all credit production
- Planet type bonuses: ocean +6 organics, volcanic +5 minerals +3 rare elements, etc.
