import { withSystemContext, auditLogs } from '@ruralbus/database';

export interface RecordAuditLogParams {
  tenantId?: string | null;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function recordAuditLog(params: RecordAuditLogParams): Promise<void> {
  try {
    await withSystemContext(async (tx) => {
      await tx.insert(auditLogs).values({
        tenantId: params.tenantId ?? null,
        userId: params.userId ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ?? null,
        metadata: params.metadata ?? {},
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
      });
    });
  } catch (err) {
    // Non-blocking logger error fallback
    console.error('Failed to write audit log:', err);
  }
}
