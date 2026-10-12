import { Schema, Types } from 'mongoose';
import { baseSchemaOptions, defineModel } from './base';
import { AUDIT_SEVERITY, AuditSeverity, SYNC_ENTITY_TYPES, SyncEntityType } from './enums';

export interface INotification {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  type: 'enrollment' | 'assignment' | 'grade' | 'certificate' | 'system' | 'feedback';
  title: string;
  body: string;
  link?: string;
  read: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['enrollment', 'assignment', 'grade', 'certificate', 'system', 'feedback'], default: 'system' },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    link: { type: String },
    read: { type: Boolean, default: false, index: true },
  },
  baseSchemaOptions,
);

notificationSchema.index({ user: 1, read: 1, createdAt: -1 });

export const Notification = defineModel<INotification>('Notification', notificationSchema);

export interface IAuditLog {
  _id: Types.ObjectId;
  actor?: Types.ObjectId;
  actorEmail?: string;
  action: string;
  entityType: string;
  entityId?: string;
  school?: Types.ObjectId;
  severity: AuditSeverity;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    actor: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    actorEmail: { type: String },
    action: { type: String, required: true, index: true },
    entityType: { type: String, required: true, index: true },
    entityId: { type: String, index: true },
    school: { type: Schema.Types.ObjectId, ref: 'School', index: true },
    severity: { type: String, enum: AUDIT_SEVERITY, default: 'info', index: true },
    ip: { type: String },
    userAgent: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  baseSchemaOptions,
);

auditLogSchema.index({ createdAt: -1 });

export const AuditLog = defineModel<IAuditLog>('AuditLog', auditLogSchema);

export interface IOfflineSyncEvent {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  entityType: SyncEntityType;
  clientId: string;
  idempotencyKey: string;
  processed: boolean;
  result?: Record<string, unknown>;
  conflict?: boolean;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const offlineSyncEventSchema = new Schema<IOfflineSyncEvent>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    entityType: { type: String, enum: SYNC_ENTITY_TYPES, required: true },
    clientId: { type: String, required: true },
    idempotencyKey: { type: String, required: true },
    processed: { type: Boolean, default: false, index: true },
    result: { type: Schema.Types.Mixed },
    conflict: { type: Boolean, default: false },
    error: { type: String },
  },
  baseSchemaOptions,
);

offlineSyncEventSchema.index({ user: 1, idempotencyKey: 1 }, { unique: true });

export const OfflineSyncEvent = defineModel<IOfflineSyncEvent>('OfflineSyncEvent', offlineSyncEventSchema);
