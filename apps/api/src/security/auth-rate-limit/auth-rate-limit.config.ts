import type { ConfigService } from '@nestjs/config';
import type {
  ThrottlerModuleOptions,
  ThrottlerOptions,
} from '@nestjs/throttler';

export const AUTH_RATE_LIMIT_POLICIES = {
  LOGIN: 'login',
  INVITATION_VERIFICATION: 'invitation-verification',
  INVITATION_ACCEPTANCE: 'invitation-acceptance',
  PASSWORD_RECOVERY_REQUEST: 'password-recovery-request',
  PASSWORD_RESET: 'password-reset',
} as const;

export type AuthRateLimitPolicy =
  (typeof AUTH_RATE_LIMIT_POLICIES)[keyof typeof AUTH_RATE_LIMIT_POLICIES];

type PolicyEnvironment = {
  readonly policy: AuthRateLimitPolicy;
  readonly limitVariable: string;
  readonly windowVariable: string;
  readonly defaultLimit: number;
  readonly defaultWindowSeconds: number;
};

const policyEnvironments: readonly PolicyEnvironment[] = [
  {
    policy: AUTH_RATE_LIMIT_POLICIES.LOGIN,
    limitVariable: 'AUTH_RATE_LIMIT_LOGIN_LIMIT',
    windowVariable: 'AUTH_RATE_LIMIT_LOGIN_WINDOW_SECONDS',
    defaultLimit: 5,
    defaultWindowSeconds: 60,
  },
  {
    policy: AUTH_RATE_LIMIT_POLICIES.INVITATION_VERIFICATION,
    limitVariable: 'AUTH_RATE_LIMIT_INVITATION_VERIFICATION_LIMIT',
    windowVariable: 'AUTH_RATE_LIMIT_INVITATION_VERIFICATION_WINDOW_SECONDS',
    defaultLimit: 20,
    defaultWindowSeconds: 60,
  },
  {
    policy: AUTH_RATE_LIMIT_POLICIES.INVITATION_ACCEPTANCE,
    limitVariable: 'AUTH_RATE_LIMIT_INVITATION_ACCEPTANCE_LIMIT',
    windowVariable: 'AUTH_RATE_LIMIT_INVITATION_ACCEPTANCE_WINDOW_SECONDS',
    defaultLimit: 5,
    defaultWindowSeconds: 300,
  },
  {
    policy: AUTH_RATE_LIMIT_POLICIES.PASSWORD_RECOVERY_REQUEST,
    limitVariable: 'AUTH_RATE_LIMIT_RECOVERY_REQUEST_LIMIT',
    windowVariable: 'AUTH_RATE_LIMIT_RECOVERY_REQUEST_WINDOW_SECONDS',
    defaultLimit: 3,
    defaultWindowSeconds: 900,
  },
  {
    policy: AUTH_RATE_LIMIT_POLICIES.PASSWORD_RESET,
    limitVariable: 'AUTH_RATE_LIMIT_PASSWORD_RESET_LIMIT',
    windowVariable: 'AUTH_RATE_LIMIT_PASSWORD_RESET_WINDOW_SECONDS',
    defaultLimit: 5,
    defaultWindowSeconds: 900,
  },
] as const;

export type RateLimitEnvironmentReader = (key: string) => string | undefined;

export function createAuthRateLimitOptions(
  readEnvironment: RateLimitEnvironmentReader = (key) => process.env[key],
): ThrottlerModuleOptions {
  return policyEnvironments.map(
    ({
      policy,
      limitVariable,
      windowVariable,
      defaultLimit,
      defaultWindowSeconds,
    }) => {
      const windowMilliseconds =
        parsePositiveInteger(
          readEnvironment(windowVariable),
          windowVariable,
          defaultWindowSeconds,
        ) * 1_000;
      return {
        name: policy,
        limit: parsePositiveInteger(
          readEnvironment(limitVariable),
          limitVariable,
          defaultLimit,
        ),
        ttl: windowMilliseconds,
        blockDuration: windowMilliseconds,
        setHeaders: true,
      } satisfies ThrottlerOptions;
    },
  );
}

export function getAuthRateLimitOptions(
  configService: ConfigService,
): ThrottlerModuleOptions {
  return createAuthRateLimitOptions((key) => configService.get<string>(key));
}

export function validateAuthRateLimitEnvironment(
  environment: Record<string, unknown>,
): Record<string, unknown> {
  createAuthRateLimitOptions((key) => {
    const value = environment[key];
    return typeof value === 'string' ? value : undefined;
  });
  return environment;
}

export function getPolicyNames(): readonly AuthRateLimitPolicy[] {
  return policyEnvironments.map(({ policy }) => policy);
}

function parsePositiveInteger(
  value: string | undefined,
  key: string,
  fallback: number,
): number {
  if (value === undefined) {
    return fallback;
  }
  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error(`${key} must be a positive integer`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed > 86_400) {
    throw new Error(`${key} must be a positive integer no greater than 86400`);
  }
  return parsed;
}
