/**
 * Ex Nihilo – Game Server Entry Point
 *
 * Creates and configures:
 *   - Fastify HTTP server (with CORS and JSON logging)
 *   - Socket.io layer (sharing the same HTTP server)
 *   - REST API routes (/health, /api/info)
 *   - GameSessionManager and SocketManager
 *
 * Graceful shutdown is handled on SIGINT and SIGTERM.
 */

import path from 'node:path';
import fs from 'node:fs';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { GameSessionManager } from './game/GameSessionManager.js';
import { SocketManager } from './network/socketManager.js';

// ---------------------------------------------------------------------------
// Save directory — stores server-side save files as JSON
// ---------------------------------------------------------------------------

const SAVES_DIR = process.env['SAVES_DIR'] ?? path.join(process.cwd(), 'saves');
fs.mkdirSync(SAVES_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PORT = Number(process.env['PORT'] ?? 3001);
const HOST = process.env['HOST'] ?? '0.0.0.0';
const VERSION = process.env['npm_package_version'] ?? '0.1.0';
const SERVER_NAME = 'Ex Nihilo Game Server';

// ---------------------------------------------------------------------------
// Server bootstrap
// ---------------------------------------------------------------------------

async function bootstrap(): Promise<void> {
  const fastify = Fastify({
    logger: {
      level: process.env['LOG_LEVEL'] ?? 'info',
      transport:
        process.env['NODE_ENV'] !== 'production'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
  });

  // Security headers — CSP, X-Content-Type-Options, X-Frame-Options, etc.
  await fastify.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'", 'ws:', 'wss:'],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
  });

  // CORS: restrict to same-origin in production, allow all in development
  const isDev = process.env['NODE_ENV'] !== 'production';
  await fastify.register(cors, {
    origin: process.env['CORS_ORIGIN'] ?? (isDev ? true : false),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  // Rate limiting: 100 requests per minute per IP
  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  const sessionManager = new GameSessionManager();
  let socketManager: SocketManager | null = null;

  // -- Routes (registered before listen) ------------------------------------

  fastify.get('/health', async () => ({
    status: 'ok',
    version: VERSION,
    uptime: process.uptime(),
  }));

  fastify.get('/api/info', async () => ({
    name: SERVER_NAME,
    version: VERSION,
    playerCount: socketManager?.connectedCount ?? 0,
    activeSessions: sessionManager.activeSessionCount,
  }));

  // ── Server-side save files ────────────────────────────────────────────────

  /** POST /api/saves — write a save file to the server. */
  fastify.post<{ Body: { name: string; data: unknown } }>('/api/saves', {
    bodyLimit: 5 * 1024 * 1024, // 5 MB (reduced from 50 MB to limit disk exhaustion)
  }, async (request, reply) => {
    const { name, data } = request.body as { name?: string; data?: unknown };
    if (!name || typeof name !== 'string' || !data) {
      return reply.status(400).send({ error: 'Missing "name" or "data" in request body.' });
    }
    // Sanitise file name — strip directory components, reject dot-only names
    const safeName = path.basename(name.replace(/[^\w\s.\-]/g, '_').trim());
    if (!safeName || /^\.+$/.test(safeName)) {
      return reply.status(400).send({ error: 'Invalid save name.' });
    }
    // Path traversal guard: ensure resolved path stays inside SAVES_DIR
    const filePath = path.resolve(SAVES_DIR, `${safeName}.json`);
    if (!filePath.startsWith(path.resolve(SAVES_DIR))) {
      return reply.status(400).send({ error: 'Invalid save path.' });
    }
    // Limit total save files to prevent disk exhaustion
    const existingFiles = fs.readdirSync(SAVES_DIR).filter(f => f.endsWith('.json'));
    if (existingFiles.length >= 100) {
      return reply.status(400).send({ error: 'Save file limit reached (100). Delete old saves first.' });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    fastify.log.info(`Save written: ${filePath}`);
    return { ok: true, file: `${safeName}.json` };
  });

  /** GET /api/saves — list all server-side save files. */
  fastify.get('/api/saves', async () => {
    const files = fs.readdirSync(SAVES_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const stat = fs.statSync(path.join(SAVES_DIR, f));
        return { name: f.replace(/\.json$/, ''), file: f, size: stat.size, modified: stat.mtimeMs };
      })
      .sort((a, b) => b.modified - a.modified);
    return { saves: files };
  });

  // -- Start ----------------------------------------------------------------

  await fastify.listen({ port: PORT, host: HOST });

  // Attach Socket.io after the HTTP server is listening
  socketManager = new SocketManager(fastify.server, sessionManager);

  fastify.log.info(
    `Ex Nihilo server running at http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`,
  );

  // -- Graceful shutdown ----------------------------------------------------

  const shutdown = async (signal: string): Promise<void> => {
    fastify.log.info(`Received ${signal} – shutting down gracefully…`);
    try {
      if (socketManager) {
        await socketManager.close();
      }
      await fastify.close();
      process.exit(0);
    } catch (err) {
      fastify.log.error({ err }, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}

bootstrap().catch((err: unknown) => {
  console.error('Fatal error during server bootstrap:', err);
  process.exit(1);
});
