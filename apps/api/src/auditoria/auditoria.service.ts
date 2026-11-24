import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import type {
  AuditAction,
  AuditResourceType,
} from '../audit/audit.constants.js';
import { buildAuditMetadata } from '../audit/audit-metadata.js';
import { AuditEvent } from '../audit/entities/audit-event.entity.js';
import { Usuario } from '../usuarios/entities/usuario.entity.js';
import type {
  AuditEventResponseDto,
  ListAuditEventsQueryDto,
  PaginatedAuditEventsResponseDto,
} from './dto/auditoria.dto.js';

type AuditEventRawRow = {
  id: string;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId: string | null;
  actorUsuarioId: string | null;
  metadata: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  actorNombre: string | null;
  actorEmail: string | null;
  actorActivo: boolean | null;
};

@Injectable()
export class AuditoriaService {
  constructor(
    @InjectRepository(AuditEvent)
    private readonly auditEventsRepository: Repository<AuditEvent>,
  ) {}

  async findAll(
    empresaId: string,
    input: ListAuditEventsQueryDto,
  ): Promise<PaginatedAuditEventsResponseDto> {
    const query = this.createScopedQuery(empresaId);

    if (input.action !== undefined) {
      query.andWhere('audit.action = :action', { action: input.action });
    }
    if (input.resourceType !== undefined) {
      query.andWhere('audit.resourceType = :resourceType', {
        resourceType: input.resourceType,
      });
    }
    if (input.resourceId !== undefined) {
      query.andWhere('audit.resourceId = :resourceId', {
        resourceId: input.resourceId,
      });
    }
    if (input.actorUsuarioId !== undefined) {
      query.andWhere('audit.actorUsuarioId = :actorUsuarioId', {
        actorUsuarioId: input.actorUsuarioId,
      });
    }
    if (input.fechaDesde !== undefined) {
      query.andWhere('audit.createdAt >= :fechaDesde', {
        fechaDesde: input.fechaDesde,
      });
    }
    if (input.fechaHasta !== undefined) {
      query.andWhere('audit.createdAt < :fechaHasta', {
        fechaHasta: input.fechaHasta,
      });
    }

    const total = await query.getCount();
    const rows = await this.selectSafeFields(query)
      .orderBy('audit.createdAt', 'DESC')
      .addOrderBy('audit.id', 'DESC')
      .offset((input.page - 1) * input.limit)
      .limit(input.limit)
      .getRawMany<AuditEventRawRow>();

    return {
      data: rows.map((row) => this.toResponse(row)),
      pagination: {
        page: input.page,
        limit: input.limit,
        total,
        totalPages: Math.ceil(total / input.limit),
      },
    };
  }

  async findOne(empresaId: string, id: string): Promise<AuditEventResponseDto> {
    const row = await this.selectSafeFields(this.createScopedQuery(empresaId))
      .andWhere('audit.id = :id', { id })
      .getRawOne<AuditEventRawRow>();

    if (!row) {
      throw new NotFoundException('Evento de auditoría no encontrado');
    }

    return this.toResponse(row);
  }

  private createScopedQuery(empresaId: string): SelectQueryBuilder<AuditEvent> {
    return this.auditEventsRepository
      .createQueryBuilder('audit')
      .leftJoin(Usuario, 'actor', 'actor.id = audit.actorUsuarioId')
      .where('audit.empresaId = :empresaId', { empresaId });
  }

  private selectSafeFields(
    query: SelectQueryBuilder<AuditEvent>,
  ): SelectQueryBuilder<AuditEvent> {
    return query
      .select('audit.id', 'id')
      .addSelect('audit.action', 'action')
      .addSelect('audit.resourceType', 'resourceType')
      .addSelect('audit.resourceId', 'resourceId')
      .addSelect('audit.actorUsuarioId', 'actorUsuarioId')
      .addSelect('audit.metadata', 'metadata')
      .addSelect('audit.ipAddress', 'ipAddress')
      .addSelect('audit.userAgent', 'userAgent')
      .addSelect('audit.createdAt', 'createdAt')
      .addSelect('actor.nombre', 'actorNombre')
      .addSelect('actor.email', 'actorEmail')
      .addSelect('actor.activo', 'actorActivo');
  }

  private toResponse(row: AuditEventRawRow): AuditEventResponseDto {
    const sourceMetadata = this.isRecord(row.metadata) ? row.metadata : {};

    return {
      id: row.id,
      action: row.action,
      resourceType: row.resourceType,
      resourceId: row.resourceId,
      actor:
        row.actorUsuarioId === null
          ? null
          : {
              id: row.actorUsuarioId,
              nombre: row.actorNombre,
              email: row.actorEmail,
              activo: row.actorActivo,
            },
      metadata: buildAuditMetadata(sourceMetadata, Object.keys(sourceMetadata)),
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
      createdAt: row.createdAt,
    };
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
