# QA — Engine Tester

Owns automated testing of game engine logic — unit tests, integration tests, regression tests for shared package and engine code.

## When to Call
Test failures, writing new tests for game logic, verifying engine fixes, regression testing after balance changes.

## Domain Files
- `packages/shared/src/**/*.test.ts` (1269 tests)
- Test runner: Vitest
- `npm run test` from workspace root

## Lessons Learnt
- All shared tests must pass before merging (1269 tests currently)
- Food consumption tests needed updating when ORGANICS_PER_POPULATION changed
- Fleet composition tests needed updating when starting fleet changed to probe
- Hull template count tests needed updating when new ship types added
