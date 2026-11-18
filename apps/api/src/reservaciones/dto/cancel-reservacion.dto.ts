import { BadRequestException } from '@nestjs/common';

export type CancelReservacionDto = {
  motivo: string | null;
};

const allowedFields = new Set(['motivo']);

export function parseCancelReservacionBody(
  body: unknown,
): CancelReservacionDto {
  const input = body === undefined ? {} : body;

  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new BadRequestException(
      'El cuerpo de la solicitud debe ser un objeto',
    );
  }

  const record = input as Record<string, unknown>;
  const unexpected = Object.keys(record).find(
    (field) => !allowedFields.has(field),
  );

  if (unexpected) {
    throw new BadRequestException(`Campo no permitido: ${unexpected}`);
  }
  if (!('motivo' in record) || record.motivo === null) {
    return { motivo: null };
  }
  if (typeof record.motivo !== 'string') {
    throw new BadRequestException('motivo debe ser texto o null');
  }

  const motivo = record.motivo.trim();

  if (motivo.length > 1_000) {
    throw new BadRequestException('motivo no puede exceder 1000 caracteres');
  }

  return { motivo: motivo.length === 0 ? null : motivo };
}
