import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { buildServer } from '../src/server.js';
import { BadRequestError, NotFoundError } from '../src/errors/AppError.js';

describe('Error Handler Integration Tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer();

    // Test route throwing custom NotFoundError
    app.get('/test/not-found-error', async () => {
      throw new NotFoundError('Custom entity was not found');
    });

    // Test route throwing custom BadRequestError with details
    app.get('/test/bad-request-error', async () => {
      throw new BadRequestError('Invalid query parameters', [
        { field: 'page', message: 'Page must be greater than 0' },
      ]);
    });

    // Test route throwing Zod validation error
    app.post('/test/zod-validation', async (request) => {
      const schema = z.object({
        name: z.string().min(3),
        age: z.number().int().positive(),
      });
      return schema.parse(request.body);
    });

    // Test route throwing unhandled exception
    app.get('/test/unhandled-error', async () => {
      throw new Error('Unexpected database connection breakdown');
    });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return standardized 404 for undefined routes', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/non-existent-endpoint-path',
    });

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);

    expect(body).toHaveProperty('success', false);
    expect(body.error).toHaveProperty('code', 'ROUTE_NOT_FOUND');
    expect(body.error).toHaveProperty('statusCode', 404);
    expect(body.error).toHaveProperty('message', 'Cannot GET /non-existent-endpoint-path');
    expect(body.error).toHaveProperty('requestId');
    expect(body.error).toHaveProperty('timestamp');
  });

  it('should format custom AppError subclasses correctly', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/test/not-found-error',
    });

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);

    expect(body).toHaveProperty('success', false);
    expect(body.error).toHaveProperty('code', 'NOT_FOUND');
    expect(body.error).toHaveProperty('statusCode', 404);
    expect(body.error).toHaveProperty('message', 'Custom entity was not found');
    expect(body.error).toHaveProperty('requestId');
  });

  it('should include error details when provided', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/test/bad-request-error',
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);

    expect(body.error).toHaveProperty('code', 'BAD_REQUEST');
    expect(body.error).toHaveProperty('details');
    expect(body.error.details).toEqual([
      { field: 'page', message: 'Page must be greater than 0' },
    ]);
  });

  it('should convert Zod validation errors into structured VALIDATION_ERROR response', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/test/zod-validation',
      payload: {
        name: 'ab', // too short (< 3)
        age: -5, // negative (< 0)
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);

    expect(body).toHaveProperty('success', false);
    expect(body.error).toHaveProperty('code', 'VALIDATION_ERROR');
    expect(body.error).toHaveProperty('statusCode', 400);
    expect(body.error).toHaveProperty('details');
    expect(body.error.details.length).toBeGreaterThanOrEqual(2);
    expect(body.error.details.some((d: any) => d.field === 'name')).toBe(true);
    expect(body.error.details.some((d: any) => d.field === 'age')).toBe(true);
  });

  it('should handle unhandled internal server errors safely (500)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/test/unhandled-error',
    });

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);

    expect(body).toHaveProperty('success', false);
    expect(body.error).toHaveProperty('code', 'INTERNAL_SERVER_ERROR');
    expect(body.error).toHaveProperty('statusCode', 500);
    expect(body.error).toHaveProperty('requestId');
  });
});
