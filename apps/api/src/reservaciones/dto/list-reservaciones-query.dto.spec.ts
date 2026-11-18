import { BadRequestException } from '@nestjs/common';
import { ReservacionEstado } from '../entities/reservacion.tenant-entity.js';
import { parseListReservacionesQuery } from './list-reservaciones-query.dto.js';

const clienteId = 'a18c2a56-d33f-4d88-a8e7-42931121e295';
const sucursalId = 'b18c2a56-d33f-4d88-a8e7-42931121e295';

describe('parseListReservacionesQuery', () => {
  it('applies pagination defaults', () => {
    expect(parseListReservacionesQuery({})).toEqual({ page: 1, limit: 20 });
  });

  it('normalizes filters and an overlapping range', () => {
    expect(
      parseListReservacionesQuery({
        page: '2',
        limit: '100',
        clienteId: clienteId.toUpperCase(),
        sucursalId,
        estado: ReservacionEstado.CONFIRMADA,
        fechaDesde: '2026-12-10T16:00:00-07:00',
        fechaHasta: '2026-12-12T16:00:00-07:00',
        q: '  ana@example.com  ',
      }),
    ).toEqual({
      page: 2,
      limit: 100,
      clienteId,
      sucursalId,
      estado: ReservacionEstado.CONFIRMADA,
      fechaDesde: new Date('2026-12-10T23:00:00.000Z'),
      fechaHasta: new Date('2026-12-12T23:00:00.000Z'),
      q: 'ana@example.com',
    });
  });

  it.each([
    { estado: 'PAGADA' },
    { fechaDesde: '2026-12-10T16:00:00' },
    {
      fechaDesde: '2026-12-12T16:00:00-07:00',
      fechaHasta: '2026-12-10T16:00:00-07:00',
    },
    { page: '0' },
    { limit: '101' },
    { q: '' },
    { empresaId: clienteId },
    { empresaSlug: 'atelier' },
    { schemaName: 'tenant_untrusted' },
  ])('rejects invalid or unknown filters: %o', (query) => {
    expect(() => parseListReservacionesQuery(query)).toThrow(
      BadRequestException,
    );
  });
});
