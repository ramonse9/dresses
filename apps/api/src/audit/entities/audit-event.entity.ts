import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { AuditAction, AuditResourceType } from '../audit.constants.js';

@Entity({ name: 'audit_events', schema: 'public' })
@Index('IDX_audit_events_empresa_created_at_id', [
  'empresaId',
  'createdAt',
  'id',
])
@Index('IDX_audit_events_actor_created_at', ['actorUsuarioId', 'createdAt'])
@Index('IDX_audit_events_resource_created_at', [
  'resourceType',
  'resourceId',
  'createdAt',
])
@Index('IDX_audit_events_action_created_at', ['action', 'createdAt'])
@Check('CHK_audit_events_action_not_empty', `BTRIM("action") <> ''`)
@Check(
  'CHK_audit_events_resource_type_not_empty',
  `BTRIM("resource_type") <> ''`,
)
@Check(
  'CHK_audit_events_metadata_object',
  `jsonb_typeof("metadata") = 'object'`,
)
export class AuditEvent {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_audit_events',
  })
  id!: string;

  @Column({ name: 'empresa_id', type: 'uuid', nullable: true })
  empresaId!: string | null;

  @Column({ name: 'actor_usuario_id', type: 'uuid', nullable: true })
  actorUsuarioId!: string | null;

  @Column({ name: 'session_id', type: 'uuid', nullable: true })
  sessionId!: string | null;

  @Column({ type: 'varchar', length: 120 })
  action!: AuditAction;

  @Column({ name: 'resource_type', type: 'varchar', length: 80 })
  resourceType!: AuditResourceType;

  @Column({ name: 'resource_id', type: 'uuid', nullable: true })
  resourceId!: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @Column({ name: 'ip_address', type: 'inet', nullable: true })
  ipAddress!: string | null;

  @Column({ name: 'user_agent', type: 'varchar', length: 512, nullable: true })
  userAgent!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      empresaId: this.empresaId,
      actorUsuarioId: this.actorUsuarioId,
      sessionId: this.sessionId,
      action: this.action,
      resourceType: this.resourceType,
      resourceId: this.resourceId,
      metadata: this.metadata,
      ipAddress: this.ipAddress,
      userAgent: this.userAgent,
      createdAt: this.createdAt,
    };
  }
}
