import { BadRequestException } from '@nestjs/common';
import { ReservacionEstado } from '../entities/reservacion.tenant-entity.js';
import {
  parseReservacionDate,
  parseReservacionUuid,
} from './create-reservacion.dto.js';

export type ListReservacionesQueryDto = {
  page: number;
  limit: number;
  clienteId?: string;
  sucursalId?: string;
  estado?: ReservacionEstado;
  fechaDesde?: Date;
  fechaHasta?: Date;
  q?: string;
};

const allowedFields = new Set([
  'page',
  'limit',
  'clienteId',
  'sucursalId',
  'estado',
  'fechaDesde',
  'fechaHasta',
  'q',
]);

function parsePositiveInteger(
  value: unknown,
  field: string,
  defaultValue: number,
  maximum?: number,
): number {
  if (value === undefined) {
    return defaultValue;
  }
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    throw new BadRequestException(`${field} debe ser un entero positivo`);
  }

  const parsed = Number(value);

  if (
    !Number.isSafeInteger(parsed) ||
    (maximum !== undefined && parsed > maximum)
  ) {
    throw new BadRequestException(
      maximum === undefined
        ? `${field} debe ser un entero positivo`
        : `${field} no puede ser mayor que ${maximum}`,
    );
  }

  return parsed;
}

export function parseListReservacionesQuery(
  query: unknown,
): ListReservacionesQueryDto {
  if (typeof query !== 'object' || query === null || Array.isArray(query)) {
    throw new BadRequestException('Los filtros deben ser un objeto');
  }

  const input = query as Record<string, unknown>;
  const unexpected = Object.keys(input).find(
    (field) => !allowedFields.has(field),
  );

  if (unexpected) {
    throw new BadRequestException(`Filtro no permitido: ${unexpected}`);
  }

  const result: ListReservacionesQueryDto = {
    page: parsePositiveInteger(input.page, 'page', 1),
    limit: parsePositiveInteger(input.limit, 'limit', 20, 100),
  };

  if ('clienteId' in input) {
    result.clienteId = parseReservacionUuid(input.clienteId, 'clienteId');
  }
  if ('sucursalId' in input) {
    result.sucursalId = parseReservacionUuid(input.sucursalId, 'sucursalId');
  }
  if ('estado' in input) {
    if (
      !Object.values(ReservacionEstado).includes(
        input.estado as ReservacionEstado,
      )
    ) {
      throw new BadRequestException('estado inválido');
    }
    result.estado = input.estado as ReservacionEstado;
  }
  if ('fechaDesde' in input) {
    result.fechaDesde = parseReservacionDate(input.fechaDesde, 'fechaDesde');
  }
  if ('fechaHasta' in input) {
    result.fechaHasta = parseReservacionDate(input.fechaHasta, 'fechaHasta');
  }
  if (
    result.fechaDesde &&
    result.fechaHasta &&
    result.fechaHasta.getTime() <= result.fechaDesde.getTime()
  ) {
    throw new BadRequestException('fechaHasta debe ser posterior a fechaDesde');
  }
  if ('q' in input) {
    if (typeof input.q !== 'string') {
      throw new BadRequestException('q debe ser texto');
    }

    const normalized = input.q.trim();

    if (normalized.length === 0 || normalized.length > 254) {
      throw new BadRequestException('q debe tener entre 1 y 254 caracteres');
    }
    result.q = normalized;
  }

  return result;
}
