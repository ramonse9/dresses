export function sumReservationMoney(values: readonly string[]): string {
  const total = values.reduce((sum, value) => sum + parseCents(value), 0n);
  const integer = total / 100n;
  const fraction = String(total % 100n).padStart(2, '0');
  return `${integer}.${fraction}`;
}

function parseCents(value: string): bigint {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) return 0n;
  return BigInt(match[1]) * 100n + BigInt((match[2] ?? '').padEnd(2, '0'));
}
