import { BadRequestException } from '@nestjs/common';

export function assertEmptyAuthBody(body: unknown): void {
  if (body === undefined || body === null) {
    return;
  }

  if (
    typeof body !== 'object' ||
    Array.isArray(body) ||
    Object.keys(body).length > 0
  ) {
    throw new BadRequestException(
      'El cuerpo de esta solicitud debe estar vacío',
    );
  }
}
