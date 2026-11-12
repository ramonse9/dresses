import { ConfigService } from '@nestjs/config';

const minimumSecretBytes = 32;
const minimumTtlSeconds = 60;
const maximumTtlSeconds = 3_600;

export function getJwtAccessTtlSeconds(configService: ConfigService): number {
  return Number(configService.getOrThrow<string>('JWT_ACCESS_TTL_SECONDS'));
}

export function validateAuthEnvironment(
  environment: Record<string, unknown>,
): Record<string, unknown> {
  const secret = environment.JWT_ACCESS_SECRET;

  if (
    typeof secret !== 'string' ||
    Buffer.byteLength(secret, 'utf8') < minimumSecretBytes
  ) {
    throw new Error(
      `JWT_ACCESS_SECRET must contain at least ${minimumSecretBytes} bytes`,
    );
  }

  const ttl = Number(environment.JWT_ACCESS_TTL_SECONDS);

  if (
    !Number.isInteger(ttl) ||
    ttl < minimumTtlSeconds ||
    ttl > maximumTtlSeconds
  ) {
    throw new Error(
      `JWT_ACCESS_TTL_SECONDS must be an integer between ${minimumTtlSeconds} and ${maximumTtlSeconds}`,
    );
  }

  return environment;
}
