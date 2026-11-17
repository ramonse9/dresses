import { BadRequestException } from '@nestjs/common';
import { VestidoEstadoOperativo } from '../entities/vestido.tenant-entity.js';
import { parseDisponibilidadVestidosQuery } from './disponibilidad-vestidos-query.dto.js';

const sucursalId = 'a18c2a56-d33f-4d88-a8e7-42931121e295';
const validQuery = {
  sucursalId,
  fechaInicio: '2026-12-10T16:00:00-07:00',
  fechaFin: '2026-12-12T16:00:00-07:00',
};

describe('parseDisponibilidadVestidosQuery', () => {
  it('normalizes the range and applies operational and pagination defaults', () => {
    expect(
      parseDisponibilidadVestidosQuery({
        ...validQuery,
        sucursalId: sucursalId.toUpperCase(),
      }),
    ).toEqual({
      sucursalId,
      fechaInicio: new Date('2026-12-10T23:00:00.000Z'),
      fechaFin: new Date('2026-12-12T23:00:00.000Z'),
      estadoOperativo: VestidoEstadoOperativo.DISPONIBLE,
      page: 1,
      limit: 20,
    });
  });

  it('accepts maintenance, catalog filters and bounded pagination', () => {
    expect(
      parseDisponibilidadVestidosQuery({
        ...validQuery,
        talla: ' M ',
        color: ' Azul ',
        estadoOperativo: VestidoEstadoOperativo.MANTENIMIENTO,
        page: '2',
        limit: '100',
      }),
    ).toMatchObject({
      talla: 'M',
      color: 'Azul',
      estadoOperativo: VestidoEstadoOperativo.MANTENIMIENTO,
      page: 2,
      limit: 100,
    });
  });

  it.each([
    { empresaId: sucursalId },
    { empresaSlug: 'atelier' },
    { schemaName: 'tenant_untrusted' },
    { activo: 'true' },
    { q: 'azul' },
  ])('rejects unknown and tenant filters: %o', (extra) => {
    expect(() =>
      parseDisponibilidadVestidosQuery({ ...validQuery, ...extra }),
    ).toThrow(BadRequestException);
  });

  it.each([
    { sucursalId: undefined },
    { sucursalId: 'not-a-uuid' },
    { fechaInicio: '2026-12-10T16:00:00' },
    { fechaInicio: '2026-02-31T16:00:00-07:00' },
    { fechaFin: '2026-12-10T16:00:00-07:00' },
    { estadoOperativo: 'RENTADO' },
    { talla: '' },
    { color: 'x'.repeat(81) },
    { page: '0' },
    { limit: '101' },
  ])('rejects invalid availability filters: %o', (change) => {
    expect(() =>
      parseDisponibilidadVestidosQuery({ ...validQuery, ...change }),
    ).toThrow(BadRequestException);
  });
});
