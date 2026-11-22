import { ConfigService } from '@nestjs/config';
import {
  getInvitacionesConfiguration,
  validateInvitacionesEnvironment,
} from './invitaciones.config.js';

describe('invitaciones configuration', () => {
  it('uses conservative defaults', () => {
    expect(getInvitacionesConfiguration(new ConfigService())).toEqual({
      ttlSeconds: 604_800,
      resendCooldownSeconds: 300,
    });
  });

  it('reads expiration and cooldown independently', () => {
    expect(
      getInvitacionesConfiguration(
        new ConfigService({
          INVITATION_TTL_SECONDS: '3600',
          INVITATION_RESEND_COOLDOWN_SECONDS: '60',
        }),
      ),
    ).toEqual({ ttlSeconds: 3_600, resendCooldownSeconds: 60 });
  });

  it.each([
    { INVITATION_TTL_SECONDS: '299' },
    { INVITATION_TTL_SECONDS: '2592001' },
    { INVITATION_RESEND_COOLDOWN_SECONDS: '0' },
    { INVITATION_RESEND_COOLDOWN_SECONDS: '86401' },
    { INVITATION_RESEND_COOLDOWN_SECONDS: 'secret-value' },
  ])('rejects invalid configuration without reflecting values: %o', (input) => {
    expect(() => validateInvitacionesEnvironment(input)).toThrow();
    try {
      validateInvitacionesEnvironment(input);
    } catch (error) {
      expect(String(error)).not.toContain('secret-value');
    }
  });
});
