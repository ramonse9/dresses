import { BadRequestException } from '@nestjs/common';
import {
  parseReservacionDate,
  parseReservacionNotas,
  parseReservacionUuid,
  parseReservacionVestidoIds,
} from './create-reservacion.dto.js';

export type UpdateReservacionDto = {
  clienteId?: string;
  sucursalId?: string;
  vestidoIds?: string[];
  fechaInicio?: Date;
  fechaFin?: Date;
  notas?: string | null;
};

const allowedFields = new Set([
  'clienteId',
  'sucursalId',
  'vestidoIds',
  'fechaInicio',
  'fechaFin',
  'notas',
]);

export function parseUpdateReservacionBody(
  body: unknown,
): UpdateReservacionDto {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new BadRequestException(
      'El cuerpo de la solicitud debe ser un objeto',
    );
  }

  const input = body as Record<string, unknown>;
  const unexpected = Object.keys(input).find(
    (field) => !allowedFields.has(field),
  );

  if (unexpected) {
    throw new BadRequestException(`Campo no permitido: ${unexpected}`);
  }
  if (Object.keys(input).length === 0) {
    throw new BadRequestException(
      'Se requiere al menos un campo para actualizar',
    );
  }

  const result: UpdateReservacionDto = {};

  if ('clienteId' in input) {
    result.clienteId = parseReservacionUuid(input.clienteId, 'clienteId');
  }
  if ('sucursalId' in input) {
    result.sucursalId = parseReservacionUuid(input.sucursalId, 'sucursalId');
  }
  if ('vestidoIds' in input) {
    result.vestidoIds = parseReservacionVestidoIds(input.vestidoIds);
  }
  if ('fechaInicio' in input) {
    result.fechaInicio = parseReservacionDate(input.fechaInicio, 'fechaInicio');
  }
  if ('fechaFin' in input) {
    result.fechaFin = parseReservacionDate(input.fechaFin, 'fechaFin');
  }
  if (
    result.fechaInicio &&
    result.fechaFin &&
    result.fechaFin.getTime() <= result.fechaInicio.getTime()
  ) {
    throw new BadRequestException('fechaFin debe ser posterior a fechaInicio');
  }
  if ('notas' in input) {
    result.notas = parseReservacionNotas(input.notas);
  }

  return result;
}
