# Ex Nihilo Security Report

**Date:** 2026-03-29
**Scope:** Full codebase at `packages/client`, `packages/server`, `packages/shared`
**Methodology:** SCA (npm audit), SAST (static pattern analysis), DAST-style route/handler review

---

## Executive Summary

The codebase demonstrates above-average security hygiene for an early-stage game server: input sanitisation is centralised, CORS is configurable, rate limiting is present on HTTP routes, Zod is used for data validation schemas, and the Tauri CSP is reasonably tight. However, several medium- and high-severity findings were identified, primarily around **path traversal on the save-file endpoint**, **plain-text lobby passwords**, **missing server-side validation of numeric lobby config**, **absence of WebSocket rate limiting**, and **known dependency vulnerabilities**.

**Findings by Severity:**

| Severity | Count |
|----------|-------|
| High     | 3     |
| Medium   | 6     |
| Low      | 4     |
| Info     | 4     |

---

## 1. SCA (Software Composition Analysis)

### 1.1 npm audit Results

`npm audit` reports **8 vulnerabilities (7 moderate, 1 high)**:

| Package | Severity | Advisory | Fix |
|---------|----------|----------|-----|
| picomatch 4.0.0-4.0.3 | **High** | ReDoS via extglob quantifiers (GHSA-c2c7-rcm5-vvqj) + method injection (GHSA-3v7f-55p6-f55p) | `npm audit fix` |
| esbuild <=0.24.2 | Moderate | Dev server request forwarding (GHSA-67mh-4wv8-2f99) | `npm audit fix --force` (breaking: vite 8.x) |
| brace-expansion <1.1.13 | Moderate | Zero-step sequence DoS (GHSA-f886-m6hf-6m8v) | `npm audit fix` |
| fastify <=5.8.2 | Moderate | X-Forwarded-Proto/Host spoofing (GHSA-444r-cwp2-x5xf) | `npm audit fix` |
| vite, vitest, vite-node | Moderate | Transitive dependency on vulnerable esbuild | Via esbuild fix |

---

## 2. SAST (Static Application Security Testing)

### Finding S1 -- Path Traversal in Save-File Endpoint

**Severity: HIGH**
**File:** `packages/server/src/main.ts`, lines 86-101
**Description:** The `POST /api/saves` endpoint sanitises the `name` field with a regex that allows dots: `name.replace(/[^\w\s.\-]/g, '_')`. An attacker can supply a name containing `../` sequences (the dots and slash-replacement to underscore still allows `..` followed by directory separators on some platforms, and the regex explicitly permits `.`). More critically, names like `..` or `.` are valid after sanitisation and could overwrite files outside the intended directory. While `\w` does not include `/` or `\`, the presence of `.` means names like `....` or relative references survive the filter.

Additionally, there is no check that the resulting `filePath` actually resides within `SAVES_DIR` after `path.join` resolution.

```typescript
const safeName = name.replace(/[^\w\s.\-]/g, '_').trim();
const filePath = path.join(SAVES_DIR, `${safeName}.json`);
fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
```

**Recommended Fix:**
1. Use `path.basename()` on the sanitised name to strip any directory components.
2. After computing `filePath`, verify it starts with `path.resolve(SAVES_DIR)`.
3. Reject names that are empty or consist solely of dots.

```typescript
const safeName = path.basename(name.replace(/[^\w\s.\-]/g, '_').trim());
if (!safeName || /^\.+$/.test(safeName)) {
  return reply.status(400).send({ error: 'Invalid save name.' });
}
const filePath = path.resolve(SAVES_DIR, `${safeName}.json`);
if (!filePath.startsWith(path.resolve(SAVES_DIR))) {
  return reply.status(400).send({ error: 'Invalid save path.' });
}
```

---

### Finding S2 -- Plain-Text Lobby Passwords (No Hashing)

**Severity: HIGH**
**File:** `packages/server/src/game/GameSessionManager.ts`, line 55-56
**File:** `packages/server/src/network/socketManager.ts`, line 355
**Description:** Lobby passwords are stored and compared as plain text. The code comment explicitly acknowledges this: `"Optional password hash (plain-text for now, good enough for dev)."` While these passwords protect game lobbies (not user accounts), they are transmitted over unencrypted WebSocket connections and stored in server memory as plain strings. If a player reuses a personal password for a game lobby, it is exposed.

```typescript
// GameSessionManager.ts:55
password: string | null = null;

// socketManager.ts:355
if (session.password !== null && session.password !== (password ?? '')) {
```

**Recommended Fix:**
1. Hash passwords on receipt with bcrypt or Argon2 before storing.
2. Compare using a constant-time comparison function.
3. Enforce TLS (WSS) in production to protect passwords in transit.

---

### Finding S3 -- No Authentication on Save-File Endpoints

**Severity: HIGH**
**File:** `packages/server/src/main.ts`, lines 86-114
**Description:** The `POST /api/saves` and `GET /api/saves` REST endpoints have no authentication or authorisation checks. Any client that can reach the server can write arbitrary JSON files (up to 50 MB each) to the server's filesystem and list all existing saves. This creates two risks:
1. **Disk exhaustion:** An attacker can flood the server with large save files.
2. **Data exposure:** Any player can read the save-file list (and potentially infer game state from file names/timestamps).

The 50 MB `bodyLimit` per request compounds the disk exhaustion risk.

**Recommended Fix:**
1. Add authentication middleware (session token, API key, or Socket.io session validation).
2. Reduce `bodyLimit` to a reasonable maximum (e.g., 5 MB).
3. Add per-IP rate limiting specific to the save endpoint (tighter than the global 100/min).
4. Limit the total number of save files per session/player.

---

### Finding S4 -- No Rate Limiting on WebSocket Events

**Severity: MEDIUM**
**File:** `packages/server/src/network/socketManager.ts`, lines 100-142
**Description:** While HTTP routes have `@fastify/rate-limit` (100 req/min), the Socket.io event handlers have no rate limiting whatsoever. A malicious client can spam `lobby:chat`, `lobby:create`, `game:action`, or `lobby:list` events at arbitrary frequency, potentially causing:
- Chat spam / denial of service for lobby members
- Memory exhaustion through rapid session creation (no session count limit exists)
- CPU load from processing thousands of events per second

**Recommended Fix:**
1. Implement per-socket rate limiting middleware for Socket.io (e.g., a sliding-window counter per event type).
2. Add a global cap on the number of concurrent sessions in `GameSessionManager`.
3. Limit the number of sessions a single socket can create within a time window.

---

### Finding S5 -- Unsanitised `maxPlayers` from Client

**Severity: MEDIUM**
**File:** `packages/server/src/network/socketManager.ts`, line 266-325 (onLobbyCreate)
**File:** `packages/server/src/game/GameSessionManager.ts`, line 283
**Description:** The `lobby:create` handler passes `config.maxPlayers` directly to `createSession()` without validation. A malicious client can send `maxPlayers: 999999` or `maxPlayers: -1` or `maxPlayers: 0`. While the session would still function (isFull checks against this value), an absurdly large value could allow unbounded player joins, and `0` or negative values would prevent any player from joining.

```typescript
// socketManager.ts — no validation of config.maxPlayers
const session = this.createSession({ maxPlayers: config.maxPlayers });
```

**Recommended Fix:**
Validate `maxPlayers` as an integer within a sensible range (e.g., 2-8):
```typescript
const maxPlayers = Math.max(2, Math.min(8, Math.floor(Number(config.maxPlayers) || 4)));
```

---

### Finding S6 -- Unsanitised `speciesId` in Lobby

**Severity: MEDIUM**
**File:** `packages/server/src/network/socketManager.ts`, lines 488-503
**Description:** The `lobby:species` handler passes `speciesId` directly to `session.setSpecies()` without any validation. There is no check that the ID corresponds to a valid species from the game data. A client could inject an arbitrary string (potentially very long) as a species ID.

**Recommended Fix:**
1. Validate `speciesId` against the list of known species IDs from shared game data.
2. At minimum, apply string length limits and character restrictions (e.g., `sanitisePlayerName`-style treatment).

---

### Finding S7 -- Unsanitised `galaxyConfig` Fields

**Severity: MEDIUM**
**File:** `packages/server/src/network/socketManager.ts`, lines 287-289
**Description:** The `lobby:create` handler sanitises `gameName`, `password`, and `seed`, but does not validate `config.galaxyConfig.size` or `config.galaxyConfig.shape`. These are expected to be specific string enums (`'small'|'medium'|'large'|'huge'` and `'spiral'|'elliptical'|'irregular'|'ring'`), but the server accepts any value. Invalid values would propagate to all clients when `lobby:game_started` is emitted.

**Recommended Fix:**
```typescript
const validSizes = new Set(['small', 'medium', 'large', 'huge']);
const validShapes = new Set(['spiral', 'elliptical', 'irregular', 'ring']);
if (!validSizes.has(config.galaxyConfig.size)) config.galaxyConfig.size = 'medium';
if (!validShapes.has(config.galaxyConfig.shape)) config.galaxyConfig.shape = 'spiral';
```

---

### Finding S8 -- Game Action Handler Lacks Validation

**Severity: MEDIUM**
**File:** `packages/server/src/network/socketManager.ts`, lines 222-260
**Description:** The `game:action` handler accepts a `data: Record<string, unknown>` payload of arbitrary structure and broadcasts it back to all players without any validation or sanitisation. The code contains a TODO comment: `"TODO: Delegate to the game engine for validation and state mutation."` Until the game engine validates actions server-side, any connected client can broadcast arbitrary data to all room members.

```typescript
// TODO: Delegate to the game engine for validation and state mutation.
// For now we acknowledge the action and broadcast the current state.
callback({ success: true });
```

**Recommended Fix:**
1. Implement server-side action validation before acknowledging.
2. Reject unrecognised `actionType` values.
3. Sanitise or schema-validate the `data` payload before broadcasting.

---

### Finding S9 -- `Math.random()` Used for Ship Design IDs

**Severity: LOW**
**File:** `packages/client/src/ui/screens/ShipDesignerScreen.tsx`, line 19
**File:** `packages/shared/src/utils/id.ts`, lines 15, 28-30
**Description:** Ship design IDs are generated with `Math.random()` which is not cryptographically secure. The shared `generateId()` utility has a `Math.random` fallback when `crypto.randomUUID` is unavailable. While these IDs are not security-sensitive (they identify game objects, not sessions), predictable IDs could theoretically allow one player to guess another's design IDs in a multiplayer context.

```typescript
// ShipDesignerScreen.tsx:19
return `design_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
```

**Recommended Fix:**
Replace with `crypto.randomUUID()` for consistency with the shared utility. The `generateId()` function from `@nova-imperia/shared` already prefers `crypto.randomUUID` and should be used everywhere.

---

### Finding S10 -- CORS Permissive in Development Mode

**Severity: LOW**
**File:** `packages/server/src/main.ts`, line 55
**File:** `packages/server/src/network/socketManager.ts`, lines 55-59
**Description:** Both Fastify and Socket.io use permissive CORS in development:
- Fastify: `origin: true` (allows all origins)
- Socket.io: allows `localhost` and `127.0.0.1` patterns

This is standard for development but could be a risk if the development server is exposed on a network (which it is, given `HOST` defaults to `0.0.0.0`). Note that the Fastify CORS and Socket.io CORS configurations use **different** environment variables (`CORS_ORIGIN` vs `EX_NIHILO_CORS_ORIGIN`), which could lead to misconfiguration where one is locked down but the other is not.

**Recommended Fix:**
1. Unify the CORS configuration to use a single environment variable.
2. In production, ensure both are explicitly restricted.
3. Consider binding to `127.0.0.1` instead of `0.0.0.0` in development.

---

### Finding S11 -- No Security Headers on HTTP Responses

**Severity: LOW**
**File:** `packages/server/src/main.ts`
**Description:** The Fastify server does not set security headers such as:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security`
- `Content-Security-Policy`

While the server primarily serves API responses (not HTML), the `/api/saves` endpoint returns user-influenced data. The Tauri desktop build has its own CSP, but browser-based access to the server is unprotected.

**Recommended Fix:**
Register `@fastify/helmet` for automatic security header injection:
```bash
npm install @fastify/helmet
```

---

### Finding S12 -- Global Window Objects Expose Engine State

**Severity: LOW**
**File:** `packages/client/src/engine/GameEngine.ts`, line 14 (`window.__GAME_ENGINE__`)
**File:** `packages/client/src/audio/AudioEngine.ts`, line 5 (`window.__EX_NIHILO_AUDIO__`)
**File:** `packages/client/src/main.ts` (`window.__EX_NIHILO_GAME__`)
**Description:** Multiple engine objects are attached to the global `window` object for cross-component communication. In a browser context, any browser extension, injected script, or DevTools user can directly mutate game engine state, audio state, and Phaser game objects. This is a concern for multiplayer fairness.

**Recommended Fix:**
Use a module-scoped singleton pattern or React context instead of `window` globals. If globals are needed for debugging, gate them behind a `NODE_ENV !== 'production'` check.

---

## 3. DAST-Style Review

### Finding D1 -- Session Enumeration via `lobby:list`

**Severity: INFO**
**File:** `packages/server/src/network/socketManager.ts`, lines 481-486
**Description:** The `lobby:list` event requires no authentication and returns all open lobby session IDs, game names, host names, and player counts. While this is expected functionality for a lobby browser, it means any connected socket can enumerate all active sessions and their hosts.

**Recommended Fix:** No immediate action required -- this is by design for a game lobby. Consider adding a cooldown or requiring the socket to have set a valid player name first.

---

### Finding D2 -- Information Disclosure in Error Messages

**Severity: INFO**
**File:** `packages/server/src/network/socketManager.ts`, various handler callbacks
**Description:** Error messages returned to clients include session IDs and session status details:
```typescript
`Session '${sessionId}' is not accepting new players (status: ${session.status}).`
`Session '${sessionId}' is full (${session.maxPlayers}/${session.maxPlayers}).`
```
These reveal internal state (exact player counts, session status) to unauthenticated clients. For a game server this is generally acceptable, but could aid targeted attacks.

**Recommended Fix:** Consider using generic error codes instead of detailed messages for production builds.

---

### Finding D3 -- No Session Expiry / Garbage Collection for Stale Sessions

**Severity: INFO**
**File:** `packages/server/src/game/GameSessionManager.ts`
**Description:** Sessions in `'waiting'` status persist indefinitely as long as at least one socket remains connected. If a client connects and creates a lobby but never disconnects (e.g., a zombie connection), the session will persist in memory forever. There is no TTL, idle timeout, or periodic cleanup mechanism.

**Recommended Fix:**
1. Add a configurable TTL for `'waiting'` sessions (e.g., 30 minutes).
2. Run a periodic sweep (e.g., every 5 minutes) to destroy expired sessions.

---

### Finding D4 -- Tauri CSP Permits Broad Local Network Access

**Severity: INFO**
**File:** `packages/client/src-tauri/tauri.conf.json`, line 26
**Description:** The Tauri CSP `connect-src` directive allows connections to any `192.168.1.*` host on any port:
```
connect-src 'self' ws://localhost:* http://localhost:* ws://192.168.1.*:* http://192.168.1.*:*
```
This is broader than necessary and could allow the desktop app to be redirected to connect to a rogue server on the local network.

**Recommended Fix:** Restrict to the specific server addresses used in deployment (e.g., `192.168.1.172:3001`, `192.168.1.12:3001`, `192.168.1.9:3001`) rather than a wildcard.

---

## 4. Positive Findings

The following security practices were noted as well-implemented:

1. **Centralised input sanitisation** (`packages/server/src/network/sanitise.ts`): String inputs are consistently stripped of control characters, trimmed, and length-limited. Type checking (`typeof raw !== 'string'`) guards against non-string input.

2. **Typed Socket.io events**: Both client and server use TypeScript interfaces for all socket events, reducing the risk of payload structure errors.

3. **Session membership checks**: All in-game event handlers verify that the requesting socket is a member of the target session before processing.

4. **Host-only game start**: The `lobby:start` handler correctly verifies that only the host socket can initiate the game.

5. **No SQL**: The application uses no database, eliminating SQL injection as an attack vector entirely.

6. **No `innerHTML` or `dangerouslySetInnerHTML`**: Zero instances found. React's default JSX escaping prevents XSS.

7. **No `eval()`, `exec()`, or `spawn()`**: Zero instances of command injection vectors found in the codebase.

8. **Zod validation schemas**: `packages/shared/src/validation/` contains rigorous Zod schemas for species and technology data.

9. **Fastify HTTP rate limiting**: 100 requests per minute per IP on all HTTP endpoints.

10. **`.gitignore` covers `.env` files**: Environment files are properly excluded from version control.

11. **`crypto.randomUUID()`** used for session IDs in `GameSessionManager` (via Node's `randomUUID`).

12. **Tauri CSP** is present and reasonably restrictive for a desktop game.

---

## 5. Remediation Priority

| Priority | Finding | Effort |
|----------|---------|--------|
| 1 | S1 -- Path traversal on save endpoint | Small (add `path.basename` + prefix check) |
| 2 | S3 -- Unauthenticated save endpoints | Medium (add auth middleware) |
| 3 | S2 -- Plain-text lobby passwords | Medium (add bcrypt hashing) |
| 4 | S4 -- No WebSocket rate limiting | Medium (add per-socket throttling) |
| 5 | S5 -- Unsanitised `maxPlayers` | Small (add range clamp) |
| 6 | S8 -- Unvalidated game actions | Large (requires game engine integration) |
| 7 | S6 -- Unsanitised `speciesId` | Small (add allowlist check) |
| 8 | S7 -- Unsanitised galaxy config enums | Small (add enum validation) |
| 9 | SCA -- `npm audit fix` for picomatch, fastify, brace-expansion | Small (run `npm audit fix`) |
| 10 | S10 -- Inconsistent CORS env vars | Small (unify to one variable) |
| 11 | S11 -- Missing security headers | Small (add `@fastify/helmet`) |
| 12 | S12 -- Window globals | Medium (refactor to module singletons) |
| 13 | S9 -- `Math.random` for IDs | Small (use `crypto.randomUUID`) |

---

*Report generated by security scan on 2026-03-29. No files were modified during this audit.*
