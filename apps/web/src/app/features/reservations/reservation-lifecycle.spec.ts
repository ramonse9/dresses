import { availableReservationTransitions } from './reservation-lifecycle';

describe('reservation lifecycle actions', () => {
  it('maps valid transitions for an owner', () => {
    expect(availableReservationTransitions('BORRADOR', 'OWNER')).toEqual(['confirmar', 'cancelar']);
    expect(availableReservationTransitions('CONFIRMADA', 'OWNER')).toEqual([
      'entregar',
      'cancelar',
    ]);
    expect(availableReservationTransitions('ENTREGADA', 'OWNER')).toEqual(['devolver']);
  });

  it('hides cancellation from employees', () => {
    expect(availableReservationTransitions('BORRADOR', 'EMPLOYEE')).toEqual(['confirmar']);
    expect(availableReservationTransitions('CONFIRMADA', 'EMPLOYEE')).toEqual(['entregar']);
  });

  it('has no actions for terminal states', () => {
    expect(availableReservationTransitions('DEVUELTA', 'OWNER')).toEqual([]);
    expect(availableReservationTransitions('CANCELADA', 'OWNER')).toEqual([]);
  });
});
