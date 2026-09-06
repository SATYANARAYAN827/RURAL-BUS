import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import { randomUUID } from 'node:crypto';
import { env } from './config/env.js';
import { requestIdPlugin } from './plugins/requestId.js';
import { requestLoggingPlugin } from './plugins/logger.js';
import { errorHandlerPlugin } from './plugins/errorHandler.js';
import { authPlugin } from './plugins/auth.js';
import { tenantPlugin } from './plugins/tenant.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { tenantRoutes } from './routes/tenant.js';
import { operatorRoutes } from './routes/operator.js';
import { fleetRoutes } from './routes/fleet.js';
import { dutyRoutes } from './routes/duty.js';
import { websocketRoutes } from './routes/ws.js';
import { telemetryRoutes } from './routes/telemetry.js';
import { discoveryRoutes } from './routes/discovery.js';
import { bookingRoutes } from './routes/booking.js';
import { paymentRoutes } from './routes/payment.js';
import { ticketRoutes } from './routes/ticket.js';
import { trajectoryRoutes } from './routes/trajectory.js';
import { offlineCashTicketRoutes } from './routes/offline-cash-ticket.js';
import { notificationRoutes } from './routes/notification.js';
import { closeRedis } from './services/redis.service.js';

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({
    requestIdHeader: 'x-request-id',
    genReqId: (req) => {
      const incomingId = req.headers['x-request-id'];
      if (typeof incomingId === 'string' && incomingId.trim().length > 0) {
        return incomingId.trim();
      }
      return randomUUID();
    },
    logger: {
      level: env.LOG_LEVEL,
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'headers.authorization',
          'headers.cookie',
        ],
        censor: '[REDACTED]',
      },
      transport:
        env.NODE_ENV === 'development'
          ? {
              target: 'pino-pretty',
              options: {
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
                colorize: true,
              },
            }
          : undefined,
    },
  });

  // Request Correlation ID Plugin (must be registered first)
  await app.register(requestIdPlugin);

  // Centralized Error Handling Plugin
  await app.register(errorHandlerPlugin);

  // WebSocket Server Plugin
  await app.register(websocket);

  // Core Security & Request Ingress Plugins
  await app.register(cors, {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'x-tenant-id', 'x-razorpay-signature'],
    exposedHeaders: ['X-Request-Id'],
  });

  await app.register(helmet, {
    contentSecurityPolicy: env.NODE_ENV === 'production',
  });

  await app.register(cookie);

  await app.register(rateLimit, {
    max: 120,
    timeWindow: '1 minute',
    allowList: (req) => req.url.startsWith('/health') || req.url.startsWith('/ws'),
  });

  // Authentication & JWT Plugin
  await app.register(authPlugin);

  // Multi-Tenant Isolation & Ingress Plugin
  await app.register(tenantPlugin);

  // Request & Response Lifecycle Logger
  await app.register(requestLoggingPlugin);

  // Routes
  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(tenantRoutes);
  await app.register(operatorRoutes);
  await app.register(fleetRoutes);
  await app.register(dutyRoutes);
  await app.register(websocketRoutes);
  await app.register(telemetryRoutes);
  await app.register(discoveryRoutes);
  await app.register(bookingRoutes);
  await app.register(paymentRoutes);
  await app.register(ticketRoutes);
  await app.register(trajectoryRoutes);
  await app.register(offlineCashTicketRoutes);
  await app.register(notificationRoutes);

  return app;
}

export async function startServer(): Promise<FastifyInstance> {
  const app = await buildServer();

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'Graceful shutdown initiated');
    try {
      await closeRedis();
      await app.close();
      app.log.info('Server closed cleanly');
      process.exit(0);
    } catch (err) {
      app.log.error({ err }, 'Error occurred during server close');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  try {
    const address = await app.listen({ port: env.PORT, host: env.HOST });
    app.log.info(`🚀 RuralBus API listening at ${address}`);
    return app;
  } catch (err) {
    app.log.fatal({ err }, 'Failed to start server');
    process.exit(1);
  }
}

// Auto-start if not in test environment
if (process.env.NODE_ENV !== 'test') {
  startServer();
}
