import { Request } from 'express';
import { AuditLog } from '../models/System';
import type { AuditSeverity } from '../models/enums';
import { logger } from './logger';

interface AuditInput {
  req?: Request;
  action: string;
  entityType: string;
  entityId?: string;
  school?: string;
  severity?: AuditSeverity;
  metadata?: Record<string, unknown>;
}

/** Fire-and-forget audit trail for sensitive actions. */
export async function audit(input: AuditInput): Promise<void> {
  try {
    await AuditLog.create({
      actor: input.req?.auth?.id,
      actorEmail: input.req?.auth?.email,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      school: input.school,
      severity: input.severity ?? 'info',
      ip: input.req?.ip,
      userAgent: input.req?.headers['user-agent'],
      metadata: input.metadata,
    });
  } catch (err) {
    logger.warn({ err, action: input.action }, 'Failed to write audit log');
  }
}
