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
    bodyLimit: 50 * 1024 * 1024, // 50 MB
  }, async (request, reply) => {
    const { name, data } = request.body as { name?: string; data?: unknown };
    if (!name || typeof name !== 'string' || !data) {
      return reply.status(400).send({ error: 'Missing "name" or "data" in request body.' });
    }
    // Sanitise file name — allow only word chars, hyphens, spaces, dots
    const safeName = name.replace(/[^\w\s.\-]/g, '_').trim();
    if (!safeName) {
      return reply.status(400).send({ error: 'Invalid save name.' });
    }
    const filePath = path.join(SAVES_DIR, `${safeName}.json`);
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
