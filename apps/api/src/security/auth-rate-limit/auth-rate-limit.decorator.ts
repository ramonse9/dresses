import { applyDecorators, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { AuthRateLimitGuard } from './auth-rate-limit.guard.js';
import {
  getPolicyNames,
  type AuthRateLimitPolicy,
} from './auth-rate-limit.config.js';

export function AuthRateLimit(policy: AuthRateLimitPolicy): MethodDecorator {
  const skippedPolicies = Object.fromEntries(
    getPolicyNames()
      .filter((candidate) => candidate !== policy)
      .map((candidate) => [candidate, true]),
  );

  return applyDecorators(
    SkipThrottle(skippedPolicies),
    UseGuards(AuthRateLimitGuard),
  );
}
