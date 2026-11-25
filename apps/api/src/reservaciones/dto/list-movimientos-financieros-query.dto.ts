import { BadRequestException } from '@nestjs/common';
import {
  MovimientoFinancieroMetodoPago,
  MovimientoFinancieroTipo,
} from '../entities/movimiento-financiero.tenant-entity.js';
import { parseReservacionDate } from './create-reservacion.dto.js';

export type ListMovimientosFinancierosQueryDto = {
  page: number;
  limit: number;
  tipo?: MovimientoFinancieroTipo;
  metodoPago?: MovimientoFinancieroMetodoPago;
  fechaDesde?: Date;
  fechaHasta?: Date;
};

const allowedFields = new Set([
  'page',
  'limit',
  'tipo',
  'metodoPago',
  'fechaDesde',
  'fechaHasta',
]);

export function parseListMovimientosFinancierosQuery(
  query: unknown,
): ListMovimientosFinancierosQueryDto {
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

  const result: ListMovimientosFinancierosQueryDto = {
    page: parsePositiveInteger(input.page, 'page', 1),
    limit: parsePositiveInteger(input.limit, 'limit', 20, 100),
  };

  if ('tipo' in input) {
    if (
      !Object.values(MovimientoFinancieroTipo).includes(
        input.tipo as MovimientoFinancieroTipo,
      )
    ) {
      throw new BadRequestException('tipo inválido');
    }
    result.tipo = input.tipo as MovimientoFinancieroTipo;
  }
  if ('metodoPago' in input) {
    if (
      !Object.values(MovimientoFinancieroMetodoPago).includes(
        input.metodoPago as MovimientoFinancieroMetodoPago,
      )
    ) {
      throw new BadRequestException('metodoPago inválido');
    }
    result.metodoPago = input.metodoPago as MovimientoFinancieroMetodoPago;
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

  return result;
}

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
