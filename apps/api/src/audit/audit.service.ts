import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import type { AuditAction, AuditResourceType } from './audit.constants.js';
import { buildAuditMetadata, type AuditMetadata } from './audit-metadata.js';
import { AuditEvent } from './entities/audit-event.entity.js';

export interface RecordAuditEventInput {
  readonly empresaId?: string | null;
  readonly actorUsuarioId?: string | null;
  readonly sessionId?: string | null;
  readonly action: AuditAction;
  readonly resourceType: AuditResourceType;
  readonly resourceId?: string | null;
  readonly metadata?: AuditMetadata;
  readonly safeMetadataFields?: readonly string[];
  readonly ipAddress?: string | null;
  readonly userAgent?: string | null;
}

export interface AuthenticatedAuditActor {
  readonly actorUsuarioId: string;
  readonly sessionId: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly dataSource: DataSource) {}

  record(
    input: RecordAuditEventInput,
    manager?: EntityManager,
  ): Promise<AuditEvent> {
    if (manager) {
      return this.persist(input, manager);
    }
    return this.dataSource.transaction((transactionManager) =>
      this.persist(input, transactionManager),
    );
  }

  private async persist(
    input: RecordAuditEventInput,
    manager: EntityManager,
  ): Promise<AuditEvent> {
    const repository = manager.getRepository(AuditEvent);
    const event = repository.create({
      empresaId: input.empresaId ?? null,
      actorUsuarioId: input.actorUsuarioId ?? null,
      sessionId: input.sessionId ?? null,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId ?? null,
      metadata: buildAuditMetadata(
        input.metadata,
        input.safeMetadataFields ?? [],
      ),
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent?.trim().slice(0, 512) || null,
    });

    return repository.save(event);
  }
}
