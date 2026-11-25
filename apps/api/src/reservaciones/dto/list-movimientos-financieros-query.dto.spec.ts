import {
  MovimientoFinancieroMetodoPago,
  MovimientoFinancieroTipo,
} from '../entities/movimiento-financiero.tenant-entity.js';
import { parseListMovimientosFinancierosQuery } from './list-movimientos-financieros-query.dto.js';

describe('parseListMovimientosFinancierosQuery', () => {
  it('applies defaults and parses all supported filters', () => {
    expect(
      parseListMovimientosFinancierosQuery({
        tipo: MovimientoFinancieroTipo.PAGO_RENTA,
        metodoPago: MovimientoFinancieroMetodoPago.TARJETA,
        fechaDesde: '2027-01-01T00:00:00-07:00',
        fechaHasta: '2027-02-01T00:00:00-07:00',
      }),
    ).toEqual({
      page: 1,
      limit: 20,
      tipo: MovimientoFinancieroTipo.PAGO_RENTA,
      metodoPago: MovimientoFinancieroMetodoPago.TARJETA,
      fechaDesde: new Date('2027-01-01T07:00:00.000Z'),
      fechaHasta: new Date('2027-02-01T07:00:00.000Z'),
    });
  });

  it.each([
    [{ empresaId: 'x' }],
    [{ schemaName: 'tenant_x' }],
    [{ limit: '101' }],
    [{ tipo: 'OTRO' }],
    [{ metodoPago: 'CRIPTO' }],
    [{ fechaDesde: '2027-01-01T00:00:00' }],
    [
      {
        fechaDesde: '2027-02-01T00:00:00Z',
        fechaHasta: '2027-01-01T00:00:00Z',
      },
    ],
  ])('rejects invalid or unknown filters %#', (query) => {
    expect(() => parseListMovimientosFinancierosQuery(query)).toThrow();
  });
});
