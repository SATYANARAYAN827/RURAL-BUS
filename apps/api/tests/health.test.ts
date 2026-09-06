import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';

describe('Health Routes Integration Tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /health/live', () => {
    it('should return 200 OK with liveness status and timestamp', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health/live',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toMatch(/application\/json/);
      expect(response.headers['x-request-id']).toBeDefined();

      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('status', 'ok');
      expect(body).toHaveProperty('timestamp');
      expect(new Date(body.timestamp).getTime()).not.toBeNaN();
    });
  });

  describe('GET /health/ready', () => {
    it('should return 200 OK with diagnostic readiness details', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health/ready',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toMatch(/application\/json/);

      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('status', 'ready');
      expect(body).toHaveProperty('version', '0.1.0');
      expect(body).toHaveProperty('nodeEnv');
      expect(body).toHaveProperty('uptimeSeconds');
      expect(typeof body.uptimeSeconds).toBe('number');
      expect(body).toHaveProperty('memoryUsage');
      expect(body.memoryUsage).toHaveProperty('rssMb');
      expect(body.memoryUsage).toHaveProperty('heapUsedMb');
      expect(body).toHaveProperty('system');
      expect(body.system).toHaveProperty('nodeVersion');
      expect(body.system).toHaveProperty('platform');
      expect(body.system).toHaveProperty('pid');
    });
  });
});
