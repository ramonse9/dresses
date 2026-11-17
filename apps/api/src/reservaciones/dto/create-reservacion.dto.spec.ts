import { BadRequestException } from '@nestjs/common';
import { parseCreateReservacionBody } from './create-reservacion.dto.js';

const clienteId = 'a18c2a56-d33f-4d88-a8e7-42931121e295';
const sucursalId = 'b18c2a56-d33f-4d88-a8e7-42931121e295';
const vestidoId = 'c18c2a56-d33f-4d88-a8e7-42931121e295';

const validBody = {
  clienteId,
  sucursalId,
  vestidoIds: [vestidoId],
  fechaInicio: '2026-12-10T16:00:00-07:00',
  fechaFin: '2026-12-12T16:00:00-07:00',
};

describe('parseCreateReservacionBody', () => {
  it('normalizes the supported fields and confirms by default', () => {
    expect(
      parseCreateReservacionBody({
        ...validBody,
        clienteId: clienteId.toUpperCase(),
        notas: '  Entregar por la tarde  ',
      }),
    ).toEqual({
      clienteId,
      sucursalId,
      vestidoIds: [vestidoId],
      fechaInicio: new Date('2026-12-10T23:00:00.000Z'),
      fechaFin: new Date('2026-12-12T23:00:00.000Z'),
      notas: 'Entregar por la tarde',
      confirmar: true,
    });
  });

  it('allows an explicit draft and converts empty notes to null', () => {
    expect(
      parseCreateReservacionBody({
        ...validBody,
        notas: '   ',
        confirmar: false,
      }),
    ).toMatchObject({ notas: null, confirmar: false });
  });

  it.each([
    { estado: 'CONFIRMADA' },
    { importeRenta: '1.00' },
    { depositoRequerido: '1.00' },
    { precioRenta: '1.00' },
    { empresaId: clienteId },
    { empresaSlug: 'atelier' },
    { schemaName: 'tenant_untrusted' },
  ])('rejects unsupported fields: %o', (extra) => {
    expect(() =>
      parseCreateReservacionBody({ ...validBody, ...extra }),
    ).toThrow(BadRequestException);
  });

  it('requires one to fifty unique UUID dress ids', () => {
    expect(() =>
      parseCreateReservacionBody({ ...validBody, vestidoIds: [] }),
    ).toThrow(BadRequestException);
    expect(() =>
      parseCreateReservacionBody({
        ...validBody,
        vestidoIds: [vestidoId, vestidoId.toUpperCase()],
      }),
    ).toThrow('vestidoIds no puede contener duplicados');
    expect(() =>
      parseCreateReservacionBody({
        ...validBody,
        vestidoIds: Array.from(
          { length: 51 },
          (_, index) =>
            `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
        ),
      }),
    ).toThrow(BadRequestException);
  });

  it.each([
    { clienteId: 'not-a-uuid' },
    { sucursalId: 'not-a-uuid' },
    { vestidoIds: ['not-a-uuid'] },
    { fechaInicio: '2026-12-10T16:00:00' },
    { fechaInicio: '2026-02-31T16:00:00-07:00' },
    { fechaFin: '2026-12-10T16:00:00-07:00' },
    { confirmar: 'true' },
    { notas: 'x'.repeat(2_001) },
  ])('rejects invalid values: %o', (change) => {
    expect(() =>
      parseCreateReservacionBody({ ...validBody, ...change }),
    ).toThrow(BadRequestException);
  });
});
