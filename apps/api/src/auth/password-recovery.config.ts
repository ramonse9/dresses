import type { ConfigService } from '@nestjs/config';

export type PasswordRecoveryConfiguration = Readonly<{
  ttlSeconds: number;
  requestCooldownSeconds: number;
}>;

const defaultTtlSeconds = 60 * 60;
const defaultRequestCooldownSeconds = 5 * 60;

export function getPasswordRecoveryConfiguration(
  configService: ConfigService,
): PasswordRecoveryConfiguration {
  return createPasswordRecoveryConfiguration((key) =>
    configService.get<string>(key),
  );
}

export function validatePasswordRecoveryEnvironment(
  environment: Record<string, unknown>,
): Record<string, unknown> {
  createPasswordRecoveryConfiguration((key) => {
    const value = environment[key];
    return typeof value === 'string' ? value : undefined;
  });
  return environment;
}

function createPasswordRecoveryConfiguration(
  readEnvironment: (key: string) => string | undefined,
): PasswordRecoveryConfiguration {
  return {
    ttlSeconds: parseInteger(
      readEnvironment('PASSWORD_RESET_TTL_SECONDS'),
      'PASSWORD_RESET_TTL_SECONDS',
      defaultTtlSeconds,
      300,
      24 * 60 * 60,
    ),
    requestCooldownSeconds: parseInteger(
      readEnvironment('PASSWORD_RESET_REQUEST_COOLDOWN_SECONDS'),
      'PASSWORD_RESET_REQUEST_COOLDOWN_SECONDS',
      defaultRequestCooldownSeconds,
      1,
      24 * 60 * 60,
    ),
  };
}

function parseInteger(
  value: string | undefined,
  key: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (value === undefined) {
    return fallback;
  }
  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error(`${key} must be a positive integer`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${key} must be between ${minimum} and ${maximum}`);
  }
  return parsed;
}
