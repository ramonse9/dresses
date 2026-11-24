import { NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import {
  AUDIT_ACTIONS,
  AUDIT_RESOURCE_TYPES,
} from '../audit/audit.constants.js';
import { AuditEvent } from '../audit/entities/audit-event.entity.js';
import { Usuario } from '../usuarios/entities/usuario.entity.js';
import { AuditoriaService } from './auditoria.service.js';

describe('AuditoriaService', () => {
  const empresaId = 'a18c2a56-d33f-4d88-a8e7-42931121e295';
  const eventId = 'b18c2a56-d33f-4d88-a8e7-42931121e295';
  const actorId = 'c18c2a56-d33f-4d88-a8e7-42931121e295';
  const resourceId = 'd18c2a56-d33f-4d88-a8e7-42931121e295';
  const createdAt = new Date('2026-11-24T15:00:00.000Z');
  const row = {
    id: eventId,
    action: AUDIT_ACTIONS.RESERVATION_UPDATED,
    resourceType: AUDIT_RESOURCE_TYPES.RESERVATION,
    resourceId,
    actorUsuarioId: actorId,
    metadata: {
      previousState: 'BORRADOR',
      newState: 'CONFIRMADA',
      password: 'must-disappear',
      nested: {
        tokenHash: 'must-disappear',
        headers: { authorization: 'must-disappear' },
        checksumHash: 'must-disappear',
        safe: true,
      },
    },
    ipAddress: '203.0.113.10',
    userAgent: 'Browser/1.0',
    createdAt,
    actorNombre: 'Owner',
    actorEmail: 'owner@example.test',
    actorActivo: true,
  };

  function createContext(options?: { detail?: typeof row | null }) {
    const builder = {
      leftJoin: vi.fn(),
      where: vi.fn(),
      andWhere: vi.fn(),
      select: vi.fn(),
      addSelect: vi.fn(),
      orderBy: vi.fn(),
      addOrderBy: vi.fn(),
      offset: vi.fn(),
      limit: vi.fn(),
      getCount: vi.fn().mockResolvedValue(21),
      getRawMany: vi.fn().mockResolvedValue([row]),
      getRawOne: vi
        .fn()
        .mockResolvedValue(
          options && 'detail' in options ? options.detail : row,
        ),
    };
    for (const method of [
      builder.leftJoin,
      builder.where,
      builder.andWhere,
      builder.select,
      builder.addSelect,
      builder.orderBy,
      builder.addOrderBy,
      builder.offset,
      builder.limit,
    ]) {
      method.mockReturnValue(builder);
    }
    const repository = {
      createQueryBuilder: vi.fn().mockReturnValue(builder),
    } as unknown as Repository<AuditEvent>;

    return {
      service: new AuditoriaService(repository),
      builder,
      repository,
    };
  }

  it('returns a scoped page with one joined actor query and safe metadata', async () => {
    const context = createContext();
    const fechaDesde = new Date('2026-11-20T00:00:00.000Z');
    const fechaHasta = new Date('2026-11-25T00:00:00.000Z');

    const result = await context.service.findAll(empresaId, {
      page: 2,
      limit: 20,
      action: row.action,
      resourceType: row.resourceType,
      resourceId,
      actorUsuarioId: actorId,
      fechaDesde,
      fechaHasta,
    });

    expect(context.builder.leftJoin).toHaveBeenCalledWith(
      Usuario,
      'actor',
      'actor.id = audit.actorUsuarioId',
    );
    expect(context.builder.where).toHaveBeenCalledWith(
      'audit.empresaId = :empresaId',
      { empresaId },
    );
    expect(context.builder.andWhere).toHaveBeenCalledWith(
      'audit.action = :action',
      { action: row.action },
    );
    expect(context.builder.andWhere).toHaveBeenCalledWith(
      'audit.resourceType = :resourceType',
      { resourceType: row.resourceType },
    );
    expect(context.builder.andWhere).toHaveBeenCalledWith(
      'audit.resourceId = :resourceId',
      { resourceId },
    );
    expect(context.builder.andWhere).toHaveBeenCalledWith(
      'audit.actorUsuarioId = :actorUsuarioId',
      { actorUsuarioId: actorId },
    );
    expect(context.builder.andWhere).toHaveBeenCalledWith(
      'audit.createdAt >= :fechaDesde',
      { fechaDesde },
    );
    expect(context.builder.andWhere).toHaveBeenCalledWith(
      'audit.createdAt < :fechaHasta',
      { fechaHasta },
    );
    expect(context.builder.orderBy).toHaveBeenCalledWith(
      'audit.createdAt',
      'DESC',
    );
    expect(context.builder.addOrderBy).toHaveBeenCalledWith('audit.id', 'DESC');
    expect(context.builder.offset).toHaveBeenCalledWith(20);
    expect(context.builder.limit).toHaveBeenCalledWith(20);
    expect(context.builder.getRawMany).toHaveBeenCalledOnce();
    expect(result).toEqual({
      data: [
        {
          id: eventId,
          action: row.action,
          resourceType: row.resourceType,
          resourceId,
          actor: {
            id: actorId,
            nombre: 'Owner',
            email: 'owner@example.test',
            activo: true,
          },
          metadata: {
            previousState: 'BORRADOR',
            newState: 'CONFIRMADA',
            nested: { safe: true },
          },
          ipAddress: '203.0.113.10',
          userAgent: 'Browser/1.0',
          createdAt,
        },
      ],
      pagination: { page: 2, limit: 20, total: 21, totalPages: 2 },
    });
    expect(JSON.stringify(result)).not.toMatch(
      /password|tokenHash|schemaName|tenant_|sessionId/,
    );
  });

  it('returns one scoped event', async () => {
    const context = createContext();

    await expect(
      context.service.findOne(empresaId, eventId),
    ).resolves.toMatchObject({ id: eventId, actor: { id: actorId } });
    expect(context.builder.andWhere).toHaveBeenCalledWith('audit.id = :id', {
      id: eventId,
    });
    expect(context.builder.getRawOne).toHaveBeenCalledOnce();
  });

  it('returns 404 for a missing or cross-company event', async () => {
    const context = createContext({ detail: null });

    await expect(
      context.service.findOne(empresaId, eventId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
