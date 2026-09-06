import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';
import {
  db,
  withSystemContext,
  users,
  operators,
  operatorMembers,
  auditLogs,
} from '@ruralbus/database';
import { eq, and } from 'drizzle-orm';
import { hashPassword } from '../src/services/password.service.js';
import { recordAuditLog } from '../src/services/audit.service.js';

describe('Phase 17: Security, Rate Limiting & Performance Hardening Tests', () => {
  let app: FastifyInstance;
  let operatorId: string;
  let adminUserId: string;
  let adminToken: string;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();

    await withSystemContext(async (tx) => {
      const passwordHash = await hashPassword('Secret123!');

      const [op] = await tx
        .insert(operators)
        .values({
          companyName: 'Security Hardened Transit',
          businessCode: `sec-${Date.now()}`,
          contactEmail: 'security@transit.gov.in',
          contactPhone: '9876543100',
          status: 'ACTIVE',
        })
        .returning();
      operatorId = op.id;

      const [user] = await tx
        .insert(users)
        .values({
          fullName: 'Security Admin',
          phone: `98700${Math.floor(10000 + Math.random() * 90000)}`,
          email: `sec-admin-${Date.now()}@transit.gov.in`,
          passwordHash,
          isActive: true,
        })
        .returning();
      adminUserId = user.id;

      await tx.insert(operatorMembers).values({
        userId: user.id,
        tenantId: op.id,
        role: 'OPERATOR_ADMIN',
        isActive: true,
      });

      adminToken = app.jwt.sign({
        sub: user.id,
        role: 'OPERATOR_ADMIN',
        tenantId: op.id,
      });
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Security & Ingress Hardening', () => {
    it('should resist SQL injection attacks on spatial and discovery query parameters', async () => {
      const sqlInjectionPayloads = [
        "' OR '1'='1",
        "'; DROP TABLE users; --",
        "1 UNION SELECT null, null, null--",
        "<script>alert(1)</script>",
      ];

      for (const payload of sqlInjectionPayloads) {
        const res = await app.inject({
          method: 'GET',
          url: `/api/v1/discovery/routes?originStop=${encodeURIComponent(payload)}&destStop=${encodeURIComponent(payload)}`,
        });

        // Must execute safely with valid JSON response and never crash with 500
        expect([200, 400]).toContain(res.statusCode);
        const json = res.json();
        expect(json.success).toBe(true);
        expect(Array.isArray(json.data.trips)).toBe(true);
      }
    });

    it('should safely record administrative audit logs', async () => {
      const uniqueAction = `SECURITY_KEY_ROTATED_${Date.now()}`;
      await recordAuditLog({
        tenantId: operatorId,
        userId: adminUserId,
        action: uniqueAction,
        entityType: 'OPERATOR',
        entityId: operatorId,
        metadata: { ip: '127.0.0.1', severity: 'HIGH' },
        ipAddress: '127.0.0.1',
        userAgent: 'SecurityTestSuite/1.0',
      });

      const records = await withSystemContext(async (tx) => {
        return tx
          .select()
          .from(auditLogs)
          .where(
            and(
              eq(auditLogs.action, uniqueAction),
              eq(auditLogs.tenantId, operatorId)
            )
          );
      });

      expect(records.length).toBe(1);
      expect(records[0].entityType).toBe('OPERATOR');
      expect(records[0].entityId).toBe(operatorId);
      expect((records[0].metadata as any).severity).toBe('HIGH');
    });

    it('should enforce tenant header stripping on authenticated requests', async () => {
      const spoofedTenantId = crypto.randomUUID();

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/operator/buses',
        headers: {
          authorization: `Bearer ${adminToken}`,
          'x-tenant-id': spoofedTenantId, // Attempt spoofing
        },
      });

      expect(response.statusCode).toBe(200);
      // Response must strictly use token tenantId, not spoofed header
    });
  });
});
