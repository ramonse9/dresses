import { BadRequestException } from '@nestjs/common';

export type CreateSucursalDto = {
  nombre: string;
  direccion?: string | null;
  telefono?: string | null;
};

export type UpdateSucursalDto = {
  nombre?: string;
  direccion?: string | null;
  telefono?: string | null;
  activo?: boolean;
};

const createFields = new Set(['nombre', 'direccion', 'telefono']);
const updateFields = new Set(['nombre', 'direccion', 'telefono', 'activo']);

function requireObject(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new BadRequestException(
      'El cuerpo de la solicitud debe ser un objeto',
    );
  }

  return body as Record<string, unknown>;
}

function rejectUnexpectedFields(
  input: Record<string, unknown>,
  allowedFields: ReadonlySet<string>,
): void {
  const unexpectedField = Object.keys(input).find(
    (field) => !allowedFields.has(field),
  );

  if (unexpectedField) {
    throw new BadRequestException(`Campo no permitido: ${unexpectedField}`);
  }
}

function parseNombre(value: unknown): string {
  if (typeof value !== 'string') {
    throw new BadRequestException('nombre es requerido');
  }

  const nombre = value.trim();

  if (nombre.length < 2 || nombre.length > 160) {
    throw new BadRequestException('nombre debe tener entre 2 y 160 caracteres');
  }

  return nombre;
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

export function parseCreateSucursalBody(body: unknown): CreateSucursalDto {
  const input = requireObject(body);
  rejectUnexpectedFields(input, createFields);

  const result: CreateSucursalDto = {
    nombre: parseNombre(input.nombre),
  };

  if ('direccion' in input) {
    result.direccion = parseOptionalText(input.direccion, 'direccion', 255);
  }

  if ('telefono' in input) {
    result.telefono = parseOptionalText(input.telefono, 'telefono', 40);
  }

  return result;
}

export function parseUpdateSucursalBody(body: unknown): UpdateSucursalDto {
  const input = requireObject(body);
  rejectUnexpectedFields(input, updateFields);

  if (Object.keys(input).length === 0) {
    throw new BadRequestException(
      'Se requiere al menos un campo para actualizar',
    );
  }

  const result: UpdateSucursalDto = {};

  if ('nombre' in input) {
    result.nombre = parseNombre(input.nombre);
  }

  if ('direccion' in input) {
    result.direccion = parseOptionalText(input.direccion, 'direccion', 255);
  }

  if ('telefono' in input) {
    result.telefono = parseOptionalText(input.telefono, 'telefono', 40);
  }

  if ('activo' in input) {
    if (typeof input.activo !== 'boolean') {
      throw new BadRequestException('activo debe ser booleano');
    }

    result.activo = input.activo;
  }

  return result;
}
