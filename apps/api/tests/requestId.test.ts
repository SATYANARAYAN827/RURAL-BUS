import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';

describe('Request ID & Correlation Tracking Integration Tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should generate a new UUID for requests without x-request-id header', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health/live',
    });

    const requestId = response.headers['x-request-id'];
    expect(requestId).toBeDefined();
    expect(typeof requestId).toBe('string');
    expect(requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  it('should preserve and echo incoming x-request-id header', async () => {
    const customCorrelationId = 'test-client-correlation-uuid-9999';

    const response = await app.inject({
      method: 'GET',
      url: '/health/live',
      headers: {
        'x-request-id': customCorrelationId,
      },
    });

    expect(response.headers['x-request-id']).toBe(customCorrelationId);
  });

  it('should propagate correlation ID to 404 error responses', async () => {
    const customCorrelationId = 'custom-404-tracing-id-1234';

    const response = await app.inject({
      method: 'GET',
      url: '/missing-path-for-test',
      headers: {
        'x-request-id': customCorrelationId,
      },
    });

    expect(response.statusCode).toBe(404);
    expect(response.headers['x-request-id']).toBe(customCorrelationId);

    const body = JSON.parse(response.body);
    expect(body.error.requestId).toBe(customCorrelationId);
  });
});
