import {
  invitationListErrorMessage,
  invitationMutationErrorMessage,
} from './team-invitation-error-message';

describe('team invitation errors', () => {
  it('keeps authorization errors distinct', () => {
    expect(invitationListErrorMessage({ status: 403, message: '' })).toContain(
      'No tienes autorización',
    );
  });

  it.each([
    [403, 'autorización'],
    [409, 'membresía activa o una invitación pendiente'],
    [429, 'esperar'],
    [503, 'correo no pudo enviarse'],
  ])('maps mutation status %s', (status, expected) => {
    expect(invitationMutationErrorMessage({ status, message: '' })).toContain(expected);
  });
});
