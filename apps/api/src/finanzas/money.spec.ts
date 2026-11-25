import {
  decimalToMinorUnits,
  minorUnitsToDecimal,
  sumDecimalValues,
} from './money.js';

describe('exact money utilities', () => {
  it('converts decimal strings to exact minor units', () => {
    expect(decimalToMinorUnits('0')).toBe(0n);
    expect(decimalToMinorUnits('0.10')).toBe(10n);
    expect(decimalToMinorUnits('9999999999.99')).toBe(999_999_999_999n);
    expect(decimalToMinorUnits('-12.34')).toBe(-1234n);
  });

  it('always formats minor units with two decimals', () => {
    expect(minorUnitsToDecimal(0n)).toBe('0.00');
    expect(minorUnitsToDecimal(1n)).toBe('0.01');
    expect(minorUnitsToDecimal(1234n)).toBe('12.34');
    expect(minorUnitsToDecimal(-5n)).toBe('-0.05');
  });

  it('sums values without floating point loss', () => {
    expect(sumDecimalValues(['0.10', '0.20', '1000000.01'])).toBe('1000000.31');
  });

  it.each(['NaN', 'Infinity', '1e3', '1.234', '', ' 1.00 '])(
    'rejects invalid persisted value %s',
    (value) => {
      expect(() => decimalToMinorUnits(value)).toThrow(
        'Invalid persisted monetary value',
      );
    },
  );
});
