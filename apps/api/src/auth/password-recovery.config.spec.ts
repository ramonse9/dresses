import { ConfigService } from '@nestjs/config';
import {
  getPasswordRecoveryConfiguration,
  validatePasswordRecoveryEnvironment,
} from './password-recovery.config.js';

describe('password recovery configuration', () => {
  it('uses safe development defaults', () => {
    expect(getPasswordRecoveryConfiguration(new ConfigService())).toEqual({
      ttlSeconds: 3_600,
      requestCooldownSeconds: 300,
    });
  });

  it('reads TTL and cooldown independently', () => {
    expect(
      getPasswordRecoveryConfiguration(
        new ConfigService({
          PASSWORD_RESET_TTL_SECONDS: '7200',
          PASSWORD_RESET_REQUEST_COOLDOWN_SECONDS: '120',
        }),
      ),
    ).toEqual({ ttlSeconds: 7_200, requestCooldownSeconds: 120 });
  });

  it('rejects invalid values without reflecting them', () => {
    for (const value of ['0', '-1', '1.5', 'secret-value']) {
      expect(() =>
        validatePasswordRecoveryEnvironment({
          PASSWORD_RESET_TTL_SECONDS: value,
        }),
      ).toThrow('PASSWORD_RESET_TTL_SECONDS');
    }
  });
});
