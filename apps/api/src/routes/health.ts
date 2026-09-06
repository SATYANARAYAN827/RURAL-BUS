import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { env } from '../config/env.js';

export const healthRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  /**
   * Liveness Probe
   * Used by Kubernetes / Docker / load balancers to determine if the container process is alive.
   */
  app.get('/health/live', async (_request, reply) => {
    return reply.status(200).send({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Readiness Probe
   * Used to check if the application is ready to accept incoming traffic.
   * Includes process diagnostics, memory metrics, and runtime uptime.
   */
  app.get('/health/ready', async (_request, reply) => {
    const memoryUsage = process.memoryUsage();
    const uptimeSeconds = Number(process.uptime().toFixed(2));

    const response = {
      status: 'ready',
      version: '0.1.0',
      nodeEnv: env.NODE_ENV,
      timestamp: new Date().toISOString(),
      uptimeSeconds,
      memoryUsage: {
        rssMb: Number((memoryUsage.rss / 1024 / 1024).toFixed(2)),
        heapTotalMb: Number((memoryUsage.heapTotal / 1024 / 1024).toFixed(2)),
        heapUsedMb: Number((memoryUsage.heapUsed / 1024 / 1024).toFixed(2)),
        externalMb: Number((memoryUsage.external / 1024 / 1024).toFixed(2)),
      },
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        pid: process.pid,
      },
    };

    return reply.status(200).send(response);
  });
};
