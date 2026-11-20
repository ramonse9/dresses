import type { EmpresaRole } from '../../core/tenant/tenant.models';
import type { ReservationStatus, ReservationTransition } from './reservation.models';

const transitionsByStatus: Readonly<Record<ReservationStatus, readonly ReservationTransition[]>> = {
  BORRADOR: ['confirmar', 'cancelar'],
  CONFIRMADA: ['entregar', 'cancelar'],
  ENTREGADA: ['devolver'],
  DEVUELTA: [],
  CANCELADA: [],
};

export function availableReservationTransitions(
  status: ReservationStatus,
  role: EmpresaRole | null,
): readonly ReservationTransition[] {
  return transitionsByStatus[status].filter(
    (transition) => transition !== 'cancelar' || role === 'OWNER',
  );
}

export function reservationTransitionLabel(transition: ReservationTransition): string {
  return {
    confirmar: 'Confirmar reservación',
    entregar: 'Registrar entrega',
    devolver: 'Registrar devolución',
    cancelar: 'Cancelar reservación',
  }[transition];
}

export function reservationTransitionDescription(transition: ReservationTransition): string {
  return {
    confirmar: 'La reservación bloqueará las piezas para el rango indicado.',
    entregar: 'La renta quedará marcada como entregada al cliente.',
    devolver: 'La renta quedará finalizada y las piezas dejarán de bloquear fechas futuras.',
    cancelar: 'La reservación quedará cancelada y liberará la disponibilidad.',
  }[transition];
}
