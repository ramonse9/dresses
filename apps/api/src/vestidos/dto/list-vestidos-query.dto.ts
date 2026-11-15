import { BadRequestException } from '@nestjs/common';
import { VestidoEstadoOperativo } from '../entities/vestido.tenant-entity.js';

export type ListVestidosQueryDto = {
  page: number;
  limit: number;
  sucursalId?: string;
  activo?: boolean;
  estadoOperativo?: VestidoEstadoOperativo;
  q?: string;
};

const allowedFields = new Set([
  'page',
  'limit',
  'sucursalId',
  'activo',
  'estadoOperativo',
  'q',
]);
const uuidV4Pattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireObject(query: unknown): Record<string, unknown> {
  if (typeof query !== 'object' || query === null || Array.isArray(query)) {
    throw new BadRequestException('Los filtros deben ser un objeto');
  }

  return query as Record<string, unknown>;
}

function rejectUnexpectedFields(input: Record<string, unknown>): void {
  const unexpectedField = Object.keys(input).find(
    (field) => !allowedFields.has(field),
  );

  if (unexpectedField) {
    throw new BadRequestException(`Filtro no permitido: ${unexpectedField}`);
  }
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

function parseOptionalUuid(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string' || !uuidV4Pattern.test(value)) {
    throw new BadRequestException('sucursalId debe ser un UUID válido');
  }

  return value.toLowerCase();
}

function parseOptionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  throw new BadRequestException('activo debe ser true o false');
}

function parseOptionalEstado(
  value: unknown,
): VestidoEstadoOperativo | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (
    value !== VestidoEstadoOperativo.DISPONIBLE &&
    value !== VestidoEstadoOperativo.MANTENIMIENTO
  ) {
    throw new BadRequestException('estadoOperativo inválido');
  }

  return value;
}

function parseOptionalSearch(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new BadRequestException('q debe ser texto');
  }

  const normalized = value.trim();

  if (normalized.length === 0 || normalized.length > 160) {
    throw new BadRequestException('q debe tener entre 1 y 160 caracteres');
  }

  return normalized;
}

export function parseListVestidosQuery(query: unknown): ListVestidosQueryDto {
  const input = requireObject(query);
  rejectUnexpectedFields(input);

  const result: ListVestidosQueryDto = {
    page: parsePositiveInteger(input.page, 'page', 1),
    limit: parsePositiveInteger(input.limit, 'limit', 20, 100),
  };
  const sucursalId = parseOptionalUuid(input.sucursalId);
  const activo = parseOptionalBoolean(input.activo);
  const estadoOperativo = parseOptionalEstado(input.estadoOperativo);
  const q = parseOptionalSearch(input.q);

  if (sucursalId !== undefined) {
    result.sucursalId = sucursalId;
  }
  if (activo !== undefined) {
    result.activo = activo;
  }
  if (estadoOperativo !== undefined) {
    result.estadoOperativo = estadoOperativo;
  }
  if (q !== undefined) {
    result.q = q;
  }

  return result;
}
