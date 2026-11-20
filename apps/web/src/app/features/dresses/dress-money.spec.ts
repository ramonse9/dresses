import { formatDressMoney } from './dress-money';

describe('formatDressMoney', () => {
  it('formats decimal strings without converting them to floating point', () => {
    expect(formatDressMoney('1250.50')).toBe('$1,250.50');
    expect(formatDressMoney('9999999999.99')).toBe('$9,999,999,999.99');
    expect(formatDressMoney('0')).toBe('$0.00');
  });

  it('represents a nullable deposit', () => {
    expect(formatDressMoney(null)).toBe('No requerido');
  });
});
