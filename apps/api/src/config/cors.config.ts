import { ConfigService } from '@nestjs/config';

const developmentOrigins = [
  'http://localhost:4200',
  'http://127.0.0.1:4200',
] as const;

export function getAllowedCorsOrigins(
  configService: ConfigService,
): readonly string[] {
  return parseAllowedOrigins(
    configService.get<string>('CORS_ALLOWED_ORIGINS'),
    configService.get<string>('NODE_ENV'),
  );
}

export function createCorsOptions(configService: ConfigService) {
  return {
    origin: [...getAllowedCorsOrigins(configService)],
    credentials: true,
  };
}

export function validateCorsEnvironment(
  environment: Record<string, unknown>,
): Record<string, unknown> {
  const rawOrigins = environment.CORS_ALLOWED_ORIGINS;
  const nodeEnvironment = environment.NODE_ENV;

  parseAllowedOrigins(
    typeof rawOrigins === 'string' ? rawOrigins : undefined,
    typeof nodeEnvironment === 'string' ? nodeEnvironment : undefined,
  );

  return environment;
}

function parseAllowedOrigins(
  rawOrigins: string | undefined,
  nodeEnvironment: string | undefined,
): readonly string[] {
  if (!rawOrigins?.trim()) {
    if (nodeEnvironment === 'production') {
      throw new Error('CORS_ALLOWED_ORIGINS is required in production');
    }

    return developmentOrigins;
  }

  const origins = rawOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0 || origins.includes('*')) {
    throw new Error(
      'CORS_ALLOWED_ORIGINS must contain explicit HTTP(S) origins',
    );
  }

  for (const origin of origins) {
    let parsed: URL;

    try {
      parsed = new URL(origin);
    } catch {
      throw new Error(`Invalid CORS origin: ${origin}`);
    }

    if (
      !['http:', 'https:'].includes(parsed.protocol) ||
      parsed.origin !== origin
    ) {
      throw new Error(`Invalid CORS origin: ${origin}`);
    }
  }

  return [...new Set(origins)];
}
