import { BadRequestException } from '@nestjs/common';

export interface RefreshTokenDto {
  refreshToken: string;
}

const refreshTokenPattern = /^[A-Za-z0-9_-]{43}$/;

export function parseRefreshTokenBody(body: unknown): RefreshTokenDto {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new BadRequestException(
      'El cuerpo de la solicitud debe ser un objeto',
    );
  }

  const input = body as Record<string, unknown>;
  const unexpectedField = Object.keys(input).find(
    (field) => field !== 'refreshToken',
  );

  if (unexpectedField) {
    throw new BadRequestException(`Campo no permitido: ${unexpectedField}`);
  }

  if (
    typeof input.refreshToken !== 'string' ||
    !refreshTokenPattern.test(input.refreshToken)
  ) {
    throw new BadRequestException('refreshToken es inválido');
  }

  return { refreshToken: input.refreshToken };
}
