import { MovimientoFinancieroMetodoPago } from '../entities/movimiento-financiero.tenant-entity.js';
import { CobroConcepto, parseCreateCobroBody } from './create-cobro.dto.js';

describe('parseCreateCobroBody', () => {
  const idempotencyKey = 'a18c2a56-d33f-4d88-a8e7-42931121e295';

  it('normalizes a strict payment request', () => {
    expect(
      parseCreateCobroBody({
        concepto: CobroConcepto.RENTA,
        monto: '500.5',
        metodoPago: MovimientoFinancieroMetodoPago.TRANSFERENCIA,
        referencia: '  TRANS-001  ',
        notas: '   ',
        idempotencyKey: idempotencyKey.toUpperCase(),
      }),
    ).toEqual({
      concepto: CobroConcepto.RENTA,
      monto: '500.50',
      metodoPago: MovimientoFinancieroMetodoPago.TRANSFERENCIA,
      referencia: 'TRANS-001',
      notas: null,
      idempotencyKey,
    });
  });

  it.each([
    500,
    '0',
    '0.00',
    '-1.00',
    '1.001',
    '1e3',
    'NaN',
    'Infinity',
    '10000000000.00',
  ])('rejects invalid monetary value %s', (monto) => {
    expect(() =>
      parseCreateCobroBody({
        concepto: CobroConcepto.RENTA,
        monto,
        metodoPago: MovimientoFinancieroMetodoPago.EFECTIVO,
        idempotencyKey,
      }),
    ).toThrow();
  });

  it.each([
    { tipo: 'PAGO_RENTA' },
    { sucursalId: idempotencyKey },
    { empresaId: idempotencyKey },
    { schemaName: 'tenant_untrusted' },
    { registradoPorUsuarioId: idempotencyKey },
    { saldoRenta: '1.00' },
    { importeRenta: '1.00' },
  ])('rejects protected field %#', (extra) => {
    expect(() =>
      parseCreateCobroBody({
        concepto: CobroConcepto.DEPOSITO,
        monto: '1.00',
        metodoPago: MovimientoFinancieroMetodoPago.EFECTIVO,
        idempotencyKey,
        ...extra,
      }),
    ).toThrow();
  });
});
