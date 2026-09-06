import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

const plugin: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.addHook('onRequest', async (request) => {
    (request as any).startTime = process.hrtime.bigint();
  });

  app.addHook('onResponse', async (request, reply) => {
    const startTime = (request as any).startTime as bigint | undefined;
    const durationMs = startTime
      ? Number(process.hrtime.bigint() - startTime) / 1_000_000
      : 0;

    const logData = {
      requestId: request.id,
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
      userAgent: request.headers['user-agent'] || 'unknown',
    };

    if (reply.statusCode >= 500) {
      request.log.error(logData, 'Request completed with server error');
    } else if (reply.statusCode >= 400) {
      request.log.warn(logData, 'Request completed with client error');
    } else {
      request.log.info(logData, 'Request completed successfully');
    }
  });
};

export const requestLoggingPlugin = fp(plugin, {
  name: 'requestLoggingPlugin',
  fastify: '5.x',
});
