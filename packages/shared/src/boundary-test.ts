/**
 * Package boundary enforcement test (MONO-06)
 *
 * This file validates that the shared package CANNOT import from client or server.
 * TypeScript project references enforce this: shared has no references to client/server,
 * so those modules are unresolvable.
 *
 * To verify: Uncomment either import below and run `npx tsc --build` — it MUST fail.
 * With both commented out, `npx tsc --build` MUST succeed.
 */

// Uncomment to test — MUST fail: shared cannot depend on client
// import type { } from '@nova-imperia/client';

// Uncomment to test — MUST fail: shared cannot depend on server
// import type { } from '@nova-imperia/server';

export {};
