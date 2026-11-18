import { BadRequestException } from '@nestjs/common';
import { parseUpdateReservacionBody } from './update-reservacion.dto.js';

const clienteId = 'a18c2a56-d33f-4d88-a8e7-42931121e295';
const sucursalId = 'b18c2a56-d33f-4d88-a8e7-42931121e295';
const vestidoId = 'c18c2a56-d33f-4d88-a8e7-42931121e295';

describe('parseUpdateReservacionBody', () => {
  it('normalizes every editable field', () => {
    expect(
      parseUpdateReservacionBody({
        clienteId: clienteId.toUpperCase(),
        sucursalId,
        vestidoIds: [vestidoId],
        fechaInicio: '2026-12-10T16:00:00-07:00',
        fechaFin: '2026-12-12T16:00:00-07:00',
        notas: '  Ajuste  ',
      }),
    ).toEqual({
      clienteId,
      sucursalId,
      vestidoIds: [vestidoId],
      fechaInicio: new Date('2026-12-10T23:00:00.000Z'),
      fechaFin: new Date('2026-12-12T23:00:00.000Z'),
      notas: 'Ajuste',
    });
  });

  it.each([
    {},
    { estado: 'CANCELADA' },
    { importeRenta: '1.00' },
    { depositoRequerido: '1.00' },
    { confirmadaAt: '2026-12-10T16:00:00-07:00' },
    { entregadaAt: null },
    { empresaId: clienteId },
    { empresaSlug: 'atelier' },
    { schemaName: 'tenant_untrusted' },
    { vestidoIds: [vestidoId, vestidoId] },
    {
      fechaInicio: '2026-12-12T16:00:00-07:00',
      fechaFin: '2026-12-10T16:00:00-07:00',
    },
  ])('rejects empty, protected or invalid updates: %o', (body) => {
    expect(() => parseUpdateReservacionBody(body)).toThrow(BadRequestException);
  });
});
