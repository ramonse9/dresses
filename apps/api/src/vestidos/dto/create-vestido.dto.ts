import { BadRequestException } from '@nestjs/common';
import { VestidoEstadoOperativo } from '../entities/vestido.tenant-entity.js';

export type CreateVestidoDto = {
  sucursalId: string;
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  talla: string;
  color: string;
  marca?: string | null;
  precioRenta: string;
  deposito?: string | null;
  estadoOperativo: VestidoEstadoOperativo;
};

const createFields = new Set([
  'sucursalId',
  'codigo',
  'nombre',
  'descripcion',
  'talla',
  'color',
  'marca',
  'precioRenta',
  'deposito',
  'estadoOperativo',
]);
const uuidV4Pattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const decimalPattern = /^(0|[1-9]\d{0,9})(?:\.(\d{1,2}))?$/;

function requireObject(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new BadRequestException(
      'El cuerpo de la solicitud debe ser un objeto',
    );
  }

  return body as Record<string, unknown>;
}

function rejectUnexpectedFields(input: Record<string, unknown>): void {
  const unexpectedField = Object.keys(input).find(
    (field) => !createFields.has(field),
  );

  if (unexpectedField) {
    throw new BadRequestException(`Campo no permitido: ${unexpectedField}`);
  }
}

function parseRequiredText(
  value: unknown,
  field: string,
  maximumLength: number,
): string {
  if (typeof value !== 'string') {
    throw new BadRequestException(`${field} es requerido`);
  }

  const normalized = value.trim();

  if (normalized.length === 0 || normalized.length > maximumLength) {
    throw new BadRequestException(
      `${field} debe tener entre 1 y ${maximumLength} caracteres`,
    );
  }

  return normalized;
}

function parseOptionalText(
  value: unknown,
  field: string,
  maximumLength: number,
): string | null {
  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new BadRequestException(`${field} debe ser texto o null`);
  }

  const normalized = value.trim();

  if (normalized.length > maximumLength) {
    throw new BadRequestException(
      `${field} no puede exceder ${maximumLength} caracteres`,
    );
  }

  return normalized.length === 0 ? null : normalized;
}

function parseMoney(value: unknown, field: string): string {
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new BadRequestException(
      `${field} debe ser un importe no negativo con máximo 2 decimales`,
    );
  }

  const rawValue = typeof value === 'string' ? value.trim() : String(value);
  const match = rawValue.match(decimalPattern);

  if (!match) {
    throw new BadRequestException(
      `${field} debe ser un importe no negativo con máximo 2 decimales`,
    );
  }

  return `${match[1]}.${(match[2] ?? '').padEnd(2, '0')}`;
}

function parseEstadoOperativo(value: unknown): VestidoEstadoOperativo {
  if (value === undefined) {
    return VestidoEstadoOperativo.DISPONIBLE;
  }

  if (
    value !== VestidoEstadoOperativo.DISPONIBLE &&
    value !== VestidoEstadoOperativo.MANTENIMIENTO
  ) {
    throw new BadRequestException('estadoOperativo inválido');
  }

  return value;
}

export function parseCreateVestidoBody(body: unknown): CreateVestidoDto {
  const input = requireObject(body);
  rejectUnexpectedFields(input);

  if (
    typeof input.sucursalId !== 'string' ||
    !uuidV4Pattern.test(input.sucursalId)
  ) {
    throw new BadRequestException('sucursalId debe ser un UUID válido');
  }

  const result: CreateVestidoDto = {
    sucursalId: input.sucursalId.toLowerCase(),
    codigo: parseRequiredText(input.codigo, 'codigo', 50).toUpperCase(),
    nombre: parseRequiredText(input.nombre, 'nombre', 160),
    talla: parseRequiredText(input.talla, 'talla', 30),
    color: parseRequiredText(input.color, 'color', 80),
    precioRenta: parseMoney(input.precioRenta, 'precioRenta'),
    estadoOperativo: parseEstadoOperativo(input.estadoOperativo),
  };

  if ('descripcion' in input) {
    result.descripcion = parseOptionalText(
      input.descripcion,
      'descripcion',
      1_000,
    );
  }

  if ('marca' in input) {
    result.marca = parseOptionalText(input.marca, 'marca', 100);
  }

  if ('deposito' in input) {
    result.deposito =
      input.deposito === null ? null : parseMoney(input.deposito, 'deposito');
  }

  return result;
}
