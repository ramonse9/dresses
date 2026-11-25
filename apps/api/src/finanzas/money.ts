const decimalPattern = /^(-?)(\d+)(?:\.(\d{1,2}))?$/;

export function decimalToMinorUnits(value: string): bigint {
  const match = decimalPattern.exec(value);

  if (!match?.[2]) {
    throw new Error('Invalid persisted monetary value');
  }

  const minorUnits =
    BigInt(match[2]) * 100n + BigInt((match[3] ?? '').padEnd(2, '0'));

  return match[1] === '-' ? -minorUnits : minorUnits;
}

export function minorUnitsToDecimal(value: bigint): string {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const formatted = `${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`;

  return negative ? `-${formatted}` : formatted;
}

export function sumDecimalValues(values: readonly string[]): string {
  return minorUnitsToDecimal(
    values.reduce((total, value) => total + decimalToMinorUnits(value), 0n),
  );
}
