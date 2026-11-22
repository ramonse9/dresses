import { validateAuthEnvironment } from '../auth/auth.config.js';
import { validateDatabaseEnvironment } from '../database/database.config.js';
import { validateMailEnvironment } from '../mail/mail.config.js';
import { validateInvitacionesEnvironment } from '../invitaciones/invitaciones.config.js';
import { validateAuthRateLimitEnvironment } from '../security/auth-rate-limit/auth-rate-limit.config.js';
import { validateCorsEnvironment } from './cors.config.js';
import { validateTrustProxyEnvironment } from './trust-proxy.config.js';

export function validateApplicationEnvironment(
  environment: Record<string, unknown>,
): Record<string, unknown> {
  validateDatabaseEnvironment(environment);
  validateAuthEnvironment(environment);
  validateCorsEnvironment(environment);
  validateMailEnvironment(environment);
  validateInvitacionesEnvironment(environment);
  validateAuthRateLimitEnvironment(environment);
  validateTrustProxyEnvironment(environment);
  return environment;
}
