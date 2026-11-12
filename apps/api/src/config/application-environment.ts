import { validateAuthEnvironment } from '../auth/auth.config.js';
import { validateDatabaseEnvironment } from '../database/database.config.js';

export function validateApplicationEnvironment(
  environment: Record<string, unknown>,
): Record<string, unknown> {
  validateDatabaseEnvironment(environment);
  validateAuthEnvironment(environment);
  return environment;
}
