import { BadRequestException } from '@nestjs/common';
import {
  AUDIT_ACTIONS,
  AUDIT_RESOURCE_TYPES,
} from '../../audit/audit.constants.js';
import { parseListAuditEventsQuery } from './auditoria.dto.js';

describe('parseListAuditEventsQuery', () => {
  it('parses pagination, filters and an explicit date range', () => {
    expect(
      parseListAuditEventsQuery({
        page: '2',
        limit: '10',
        action: AUDIT_ACTIONS.RESERVATION_UPDATED,
        resourceType: AUDIT_RESOURCE_TYPES.RESERVATION,
        resourceId: 'A18C2A56-D33F-4D88-A8E7-42931121E295',
        actorUsuarioId: 'B18C2A56-D33F-4D88-A8E7-42931121E295',
        fechaDesde: '2026-11-20T10:00:00-07:00',
        fechaHasta: '2026-11-21T10:00:00-07:00',
      }),
    ).toEqual({
      page: 2,
      limit: 10,
      action: AUDIT_ACTIONS.RESERVATION_UPDATED,
      resourceType: AUDIT_RESOURCE_TYPES.RESERVATION,
      resourceId: 'a18c2a56-d33f-4d88-a8e7-42931121e295',
      actorUsuarioId: 'b18c2a56-d33f-4d88-a8e7-42931121e295',
      fechaDesde: new Date('2026-11-20T17:00:00.000Z'),
      fechaHasta: new Date('2026-11-21T17:00:00.000Z'),
    });
  });

  it('uses the standard pagination defaults', () => {
    expect(parseListAuditEventsQuery({})).toEqual({ page: 1, limit: 20 });
  });

  it.each([
    [{ empresaId: 'a18c2a56-d33f-4d88-a8e7-42931121e295' }],
    [{ schemaName: 'tenant_a18c2a56d33f4d88a8e742931121e295' }],
    [{ empresaSlug: 'atelier' }],
    [{ limit: '101' }],
    [{ action: 'unknown.action' }],
    [{ resourceType: 'unknown' }],
    [{ resourceId: 'not-a-uuid' }],
    [{ fechaDesde: '2026-11-20T10:00:00' }],
    [
      {
        fechaDesde: '2026-11-21T10:00:00Z',
        fechaHasta: '2026-11-20T10:00:00Z',
      },
    ],
  ])('rejects unsafe or invalid filters: %j', (query) => {
    expect(() => parseListAuditEventsQuery(query)).toThrow(BadRequestException);
  });
});
