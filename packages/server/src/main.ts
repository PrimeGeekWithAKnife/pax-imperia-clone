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
import { registerRoutes } from './api/routes.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PORT = Number(process.env['PORT'] ?? 3001);
const HOST = process.env['HOST'] ?? '0.0.0.0';
const VERSION = process.env['npm_package_version'] ?? '0.1.0';

// ---------------------------------------------------------------------------
// Server bootstrap
// ---------------------------------------------------------------------------

async function bootstrap(): Promise<void> {
  // -- Fastify ---------------------------------------------------------------

  const fastify = Fastify({
    logger: {
      level: process.env['LOG_LEVEL'] ?? 'info',
      transport:
        process.env['NODE_ENV'] !== 'production'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
  });

  // -- CORS ------------------------------------------------------------------

  await fastify.register(cors, {
    // Allow all origins in development; tighten in production via env config.
    origin: process.env['CORS_ORIGIN'] ?? true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  // -- Game layer ------------------------------------------------------------

  const sessionManager = new GameSessionManager();

  // Socket.io attaches itself to the underlying Node.js HTTP server that
  // Fastify wraps.  We must access it AFTER Fastify has bound to the port,
  // so we defer SocketManager construction until after listen().

  // -- Routes ----------------------------------------------------------------

  // Placeholder – socketManager will be passed in after server starts.
  // We register routes lazily so the socketManager reference is available.
  let socketManager: SocketManager;

  fastify.addHook('onReady', async () => {
    // At this point the HTTP server is listening; it's safe to attach Socket.io.
    socketManager = new SocketManager(fastify.server, sessionManager);

    await registerRoutes(fastify, {
      version: VERSION,
      sessionManager,
      socketManager,
    });

    fastify.log.info('Socket.io initialised and routes registered.');
  });

  // -- Start -----------------------------------------------------------------

  await fastify.listen({ port: PORT, host: HOST });

  fastify.log.info(
    `Nova Imperia server running at http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`,
  );

  // -- Graceful shutdown -----------------------------------------------------

  const shutdown = async (signal: string): Promise<void> => {
    fastify.log.info(`Received ${signal} – shutting down gracefully…`);

    try {
      // Stop accepting new Socket.io connections and close existing ones.
      if (socketManager) {
        await socketManager.close();
        fastify.log.info('Socket.io server closed.');
      }

      // Stop the Fastify / HTTP server.
      await fastify.close();
      fastify.log.info('Fastify server closed.');

      process.exit(0);
    } catch (err) {
      fastify.log.error({ err }, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

bootstrap().catch((err: unknown) => {
  console.error('Fatal error during server bootstrap:', err);
  process.exit(1);
});
