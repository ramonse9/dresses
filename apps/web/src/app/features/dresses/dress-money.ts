export function formatDressMoney(value: string | null): string {
  if (value === null) {
    return 'No requerido';
  }

  const match = /^(?<sign>-?)(?<integer>\d+)(?:\.(?<fraction>\d+))?$/.exec(value.trim());
  if (!match?.groups) {
    return value;
  }

  const sign = match.groups['sign'];
  const integer = match.groups['integer'].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fraction = (match.groups['fraction'] ?? '').padEnd(2, '0').slice(0, 2);
  return `${sign}$${integer}.${fraction}`;
}
