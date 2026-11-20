import { sumReservationMoney } from './reservation-estimate';

describe('sumReservationMoney', () => {
  it('adds decimal strings exactly without floating point arithmetic', () => {
    expect(sumReservationMoney(['0.10', '0.20', '1250.05'])).toBe('1250.35');
  });

  it('supports large values and normalizes one decimal place', () => {
    expect(sumReservationMoney(['9999999999.99', '0.1'])).toBe('10000000000.09');
  });
});
