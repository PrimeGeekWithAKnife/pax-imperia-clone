/**
 * REST API route registrations for Nova Imperia.
 *
 * Routes:
 *   GET /health       – liveness probe used by load balancers / orchestrators
 *   GET /api/info     – public server metadata
 */

import type { FastifyInstance } from 'fastify';
import type { GameSessionManager } from '../game/GameSessionManager.js';
import type { SocketManager } from '../network/socketManager.js';

const SERVER_NAME = 'Nova Imperia Game Server';

interface RouteOptions {
  version: string;
  sessionManager: GameSessionManager;
  socketManager: SocketManager;
}

export async function registerRoutes(
  fastify: FastifyInstance,
  options: RouteOptions,
): Promise<void> {
  const { version, sessionManager, socketManager } = options;

  // -------------------------------------------------------------------------
  // GET /health
  // -------------------------------------------------------------------------

  fastify.get('/health', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            version: { type: 'string' },
            uptime: { type: 'number' },
          },
        },
      },
    },
  }, async (_request, _reply) => {
    return {
      status: 'ok',
      version,
      uptime: process.uptime(),
    };
  });

  // -------------------------------------------------------------------------
  // GET /api/info
  // -------------------------------------------------------------------------

  fastify.get('/api/info', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            version: { type: 'string' },
            playerCount: { type: 'number' },
            activeSessions: { type: 'number' },
          },
        },
      },
    },
  }, async (_request, _reply) => {
    return {
      name: SERVER_NAME,
      version,
      playerCount: socketManager.connectedCount,
      activeSessions: sessionManager.activeSessionCount,
    };
  });
}
