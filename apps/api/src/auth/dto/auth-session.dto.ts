import { BadRequestException } from '@nestjs/common';

export type ListAuthSessionsQueryDto = {
  revoked: boolean;
  limit: number;
};

export type AuthSessionResponseDto = {
  id: string;
  current: boolean;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  ipAddress: string | null;
  userAgent: string | null;
};

export type RevokeOtherSessionsResponseDto = {
  revokedCount: number;
};

const listFields = new Set(['revoked', 'limit']);

export function parseListAuthSessionsQuery(
  query: unknown,
): ListAuthSessionsQueryDto {
  const input = requireObject(query);
  const unexpected = Object.keys(input).find((field) => !listFields.has(field));

  if (unexpected) {
    throw new BadRequestException(`Filtro no permitido: ${unexpected}`);
  }

  return {
    revoked: parseBoolean(input.revoked, 'revoked', false),
    limit: parsePositiveInteger(input.limit, 'limit', 50, 100),
  };
}

export function assertEmptyAuthSessionsQuery(query: unknown): void {
  const input = requireObject(query);
  const unexpected = Object.keys(input)[0];

  if (unexpected) {
    throw new BadRequestException(`Filtro no permitido: ${unexpected}`);
  }
}

function requireObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new BadRequestException('Los filtros deben ser un objeto');
  }

  return value as Record<string, unknown>;
}

function parseBoolean(
  value: unknown,
  field: string,
  defaultValue: boolean,
): boolean {
  if (value === undefined) {
    return defaultValue;
  }
  if (value !== 'true' && value !== 'false') {
    throw new BadRequestException(`${field} debe ser true o false`);
  }
  return value === 'true';
}

function parsePositiveInteger(
  value: unknown,
  field: string,
  defaultValue: number,
  maximum: number,
): number {
  if (value === undefined) {
    return defaultValue;
  }
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    throw new BadRequestException(`${field} debe ser un entero positivo`);
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed > maximum) {
    throw new BadRequestException(`${field} no puede ser mayor que ${maximum}`);
  }
  return parsed;
}
