import { BadRequestException } from '@nestjs/common';
import { parseCancelReservacionBody } from './cancel-reservacion.dto.js';

describe('parseCancelReservacionBody', () => {
  it('accepts an omitted reason and normalizes text', () => {
    expect(parseCancelReservacionBody(undefined)).toEqual({ motivo: null });
    expect(parseCancelReservacionBody({})).toEqual({ motivo: null });
    expect(
      parseCancelReservacionBody({ motivo: '  Cambio de planes  ' }),
    ).toEqual({ motivo: 'Cambio de planes' });
    expect(parseCancelReservacionBody({ motivo: '   ' })).toEqual({
      motivo: null,
    });
  });

  it('rejects unknown fields, invalid values and oversized reasons', () => {
    for (const body of [
      { estado: 'CANCELADA' },
      { empresaId: 'untrusted' },
      { schemaName: 'tenant_untrusted' },
      { motivo: 123 },
      { motivo: 'x'.repeat(1_001) },
    ]) {
      expect(() => parseCancelReservacionBody(body)).toThrow(
        BadRequestException,
      );
    }
  });
});
