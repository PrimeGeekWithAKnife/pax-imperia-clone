/**
 * Nova Imperia – Game Server Entry Point
 *
 * Creates and configures:
 *   - Fastify HTTP server (with CORS and JSON logging)
 *   - Socket.io layer (sharing the same HTTP server)
 *   - REST API routes (/health, /api/info)
 *   - GameSessionManager and SocketManager
 *
 * Graceful shutdown is handled on SIGINT and SIGTERM.
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { GameSessionManager } from './game/GameSessionManager.js';
import { SocketManager } from './network/socketManager.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PORT = Number(process.env['PORT'] ?? 3001);
const HOST = process.env['HOST'] ?? '0.0.0.0';
const VERSION = process.env['npm_package_version'] ?? '0.1.0';
const SERVER_NAME = 'Nova Imperia Game Server';

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

  await fastify.register(cors, {
    origin: process.env['CORS_ORIGIN'] ?? true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
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

  // -- Start ----------------------------------------------------------------

  await fastify.listen({ port: PORT, host: HOST });

  // Attach Socket.io after the HTTP server is listening
  socketManager = new SocketManager(fastify.server, sessionManager);

  fastify.log.info(
    `Nova Imperia server running at http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`,
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
