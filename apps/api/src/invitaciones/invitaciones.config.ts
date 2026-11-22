import type { ConfigService } from '@nestjs/config';

export type InvitacionesConfiguration = Readonly<{
  ttlSeconds: number;
  resendCooldownSeconds: number;
}>;

const defaultTtlSeconds = 7 * 24 * 60 * 60;
const defaultResendCooldownSeconds = 5 * 60;

export function getInvitacionesConfiguration(
  configService: ConfigService,
): InvitacionesConfiguration {
  return createInvitacionesConfiguration((key) =>
    configService.get<string>(key),
  );
}

export function validateInvitacionesEnvironment(
  environment: Record<string, unknown>,
): Record<string, unknown> {
  createInvitacionesConfiguration((key) => {
    const value = environment[key];
    return typeof value === 'string' ? value : undefined;
  });
  return environment;
}

function createInvitacionesConfiguration(
  readEnvironment: (key: string) => string | undefined,
): InvitacionesConfiguration {
  return {
    ttlSeconds: parseInteger(
      readEnvironment('INVITATION_TTL_SECONDS'),
      'INVITATION_TTL_SECONDS',
      defaultTtlSeconds,
      300,
      30 * 24 * 60 * 60,
    ),
    resendCooldownSeconds: parseInteger(
      readEnvironment('INVITATION_RESEND_COOLDOWN_SECONDS'),
      'INVITATION_RESEND_COOLDOWN_SECONDS',
      defaultResendCooldownSeconds,
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
