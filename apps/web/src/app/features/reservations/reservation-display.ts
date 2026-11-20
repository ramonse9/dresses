import type { ReservationStatus } from './reservation.models';

const labels: Record<ReservationStatus, string> = {
  BORRADOR: 'Borrador',
  CONFIRMADA: 'Confirmada',
  ENTREGADA: 'Entregada',
  DEVUELTA: 'Devuelta',
  CANCELADA: 'Cancelada',
};

export function reservationStatusLabel(status: ReservationStatus): string {
  return labels[status];
}

export function formatReservationDate(value: string | null): string {
  if (!value) return 'No registrado';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}
