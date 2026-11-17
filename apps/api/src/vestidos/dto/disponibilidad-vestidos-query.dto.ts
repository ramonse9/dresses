import { BadRequestException } from '@nestjs/common';
import { VestidoEstadoOperativo } from '../entities/vestido.tenant-entity.js';

export type DisponibilidadVestidosQueryDto = {
  sucursalId: string;
  fechaInicio: Date;
  fechaFin: Date;
  talla?: string;
  color?: string;
  estadoOperativo: VestidoEstadoOperativo;
  page: number;
  limit: number;
};

const allowedFields = new Set([
  'sucursalId',
  'fechaInicio',
  'fechaFin',
  'talla',
  'color',
  'estadoOperativo',
  'page',
  'limit',
]);
const uuidV4Pattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isoDateTimeWithTimezonePattern =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

function requireObject(query: unknown): Record<string, unknown> {
  if (typeof query !== 'object' || query === null || Array.isArray(query)) {
    throw new BadRequestException('Los filtros deben ser un objeto');
  }

  return query as Record<string, unknown>;
}

function parseRequiredUuid(value: unknown): string {
  if (typeof value !== 'string' || !uuidV4Pattern.test(value)) {
    throw new BadRequestException('sucursalId debe ser un UUID válido');
  }

  return value.toLowerCase();
}

function parseDate(value: unknown, field: string): Date {
  const rawValue = typeof value === 'string' ? value : null;
  const match = rawValue ? isoDateTimeWithTimezonePattern.exec(rawValue) : null;

  if (!match) {
    throw new BadRequestException(
      `${field} debe ser una fecha ISO 8601 con zona horaria`,
    );
  }

  const [, yearRaw, monthRaw, dayRaw, hourRaw, minuteRaw, secondRaw] = match;
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  const second = Number(secondRaw);
  const maximumDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > maximumDay ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    throw new BadRequestException(`${field} no es una fecha válida`);
  }

  const parsed = new Date(match[0]);

  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`${field} no es una fecha válida`);
  }

  return parsed;
}

function parseOptionalText(
  value: unknown,
  field: string,
  maximumLength: number,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new BadRequestException(`${field} debe ser texto`);
  }

  const normalized = value.trim();

  if (normalized.length === 0 || normalized.length > maximumLength) {
    throw new BadRequestException(
      `${field} debe tener entre 1 y ${maximumLength} caracteres`,
    );
  }

  return normalized;
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

export function parseDisponibilidadVestidosQuery(
  query: unknown,
): DisponibilidadVestidosQueryDto {
  const input = requireObject(query);
  const unexpected = Object.keys(input).find(
    (field) => !allowedFields.has(field),
  );

  if (unexpected) {
    throw new BadRequestException(`Filtro no permitido: ${unexpected}`);
  }

  const fechaInicio = parseDate(input.fechaInicio, 'fechaInicio');
  const fechaFin = parseDate(input.fechaFin, 'fechaFin');

  if (fechaFin.getTime() <= fechaInicio.getTime()) {
    throw new BadRequestException('fechaFin debe ser posterior a fechaInicio');
  }
  if (
    input.estadoOperativo !== undefined &&
    input.estadoOperativo !== VestidoEstadoOperativo.DISPONIBLE &&
    input.estadoOperativo !== VestidoEstadoOperativo.MANTENIMIENTO
  ) {
    throw new BadRequestException('estadoOperativo inválido');
  }

  const result: DisponibilidadVestidosQueryDto = {
    sucursalId: parseRequiredUuid(input.sucursalId),
    fechaInicio,
    fechaFin,
    estadoOperativo: input.estadoOperativo ?? VestidoEstadoOperativo.DISPONIBLE,
    page: parsePositiveInteger(input.page, 'page', 1),
    limit: parsePositiveInteger(input.limit, 'limit', 20, 100),
  };
  const talla = parseOptionalText(input.talla, 'talla', 30);
  const color = parseOptionalText(input.color, 'color', 80);

  if (talla !== undefined) {
    result.talla = talla;
  }
  if (color !== undefined) {
    result.color = color;
  }

  return result;
}
