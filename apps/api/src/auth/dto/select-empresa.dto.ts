import { BadRequestException } from '@nestjs/common';

export interface SelectEmpresaDto {
  empresaId: string;
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseSelectEmpresaBody(body: unknown): SelectEmpresaDto {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new BadRequestException(
      'El cuerpo de la solicitud debe ser un objeto',
    );
  }

  const input = body as Record<string, unknown>;
  const unexpectedField = Object.keys(input).find(
    (field) => field !== 'empresaId',
  );

  if (unexpectedField) {
    throw new BadRequestException(`Campo no permitido: ${unexpectedField}`);
  }

  if (
    typeof input.empresaId !== 'string' ||
    !uuidPattern.test(input.empresaId)
  ) {
    throw new BadRequestException('empresaId debe ser un UUID válido');
  }

  return { empresaId: input.empresaId };
}
