import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { randomUUID } from 'node:crypto';

export const REQUEST_ID_HEADER = 'x-request-id';

export function generateRequestId(): string {
  return randomUUID();
}

const plugin: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.addHook('onRequest', async (request, reply) => {
    const incomingId = request.headers[REQUEST_ID_HEADER];
    const reqId =
      typeof incomingId === 'string' && incomingId.trim().length > 0
        ? incomingId.trim()
        : generateRequestId();

    request.id = reqId;
    reply.header(REQUEST_ID_HEADER, reqId);
  });

  app.addHook('onSend', async (request, reply, payload) => {
    if (!reply.hasHeader(REQUEST_ID_HEADER) && request.id) {
      reply.header(REQUEST_ID_HEADER, request.id);
    }
    return payload;
  });
};

export const requestIdPlugin = fp(plugin, {
  name: 'requestIdPlugin',
  fastify: '5.x',
});
