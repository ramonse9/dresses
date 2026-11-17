import { BadRequestException } from '@nestjs/common';

export type CreateClienteDto = {
  nombre: string;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
  notas?: string | null;
};

export type UpdateClienteDto = Partial<CreateClienteDto>;

export type UpdateClienteEstadoDto = {
  activo: boolean;
};

export type ListClientesQueryDto = {
  page: number;
  limit: number;
  activo?: boolean;
  q?: string;
};

export type PaginatedClientesResponseDto = {
  data: Array<{
    id: string;
    nombre: string;
    telefono: string | null;
    email: string | null;
    direccion: string | null;
    notas: string | null;
    activo: boolean;
    createdAt: Date;
    updatedAt: Date;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

const clienteFields = new Set([
  'nombre',
  'telefono',
  'email',
  'direccion',
  'notas',
]);
const listFields = new Set(['page', 'limit', 'activo', 'q']);

function requireObject(
  value: unknown,
  message: string,
): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new BadRequestException(message);
  }

  return value as Record<string, unknown>;
}

function rejectUnexpectedFields(
  input: Record<string, unknown>,
  fields: ReadonlySet<string>,
  prefix = 'Campo',
): void {
  const unexpected = Object.keys(input).find((field) => !fields.has(field));

  if (unexpected) {
    throw new BadRequestException(`${prefix} no permitido: ${unexpected}`);
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

function parseClienteFields(
  input: Record<string, unknown>,
  requireNombre: boolean,
): CreateClienteDto | UpdateClienteDto {
  const result: UpdateClienteDto = {};

  if (requireNombre || 'nombre' in input) {
    result.nombre = parseRequiredText(input.nombre, 'nombre', 160);
  }
  if ('telefono' in input) {
    result.telefono = parseOptionalText(input.telefono, 'telefono', 40);
  }
  if ('email' in input) {
    const email = parseOptionalText(input.email, 'email', 254);
    result.email = email?.toLowerCase() ?? null;
  }
  if ('direccion' in input) {
    result.direccion = parseOptionalText(input.direccion, 'direccion', 255);
  }
  if ('notas' in input) {
    result.notas = parseOptionalText(input.notas, 'notas', 2_000);
  }

  return result;
}

export function parseCreateClienteBody(body: unknown): CreateClienteDto {
  const input = requireObject(
    body,
    'El cuerpo de la solicitud debe ser un objeto',
  );
  rejectUnexpectedFields(input, clienteFields);
  const result = parseClienteFields(input, true) as CreateClienteDto;

  if (!result.telefono && !result.email) {
    throw new BadRequestException('Se requiere telefono o email');
  }

  return result;
}

export function parseUpdateClienteBody(body: unknown): UpdateClienteDto {
  const input = requireObject(
    body,
    'El cuerpo de la solicitud debe ser un objeto',
  );
  rejectUnexpectedFields(input, clienteFields);

  if (Object.keys(input).length === 0) {
    throw new BadRequestException(
      'Se requiere al menos un campo para actualizar',
    );
  }

  return parseClienteFields(input, false);
}

export function parseUpdateClienteEstadoBody(
  body: unknown,
): UpdateClienteEstadoDto {
  const input = requireObject(
    body,
    'El cuerpo de la solicitud debe ser un objeto',
  );
  rejectUnexpectedFields(input, new Set(['activo']));

  if (Object.keys(input).length !== 1 || typeof input.activo !== 'boolean') {
    throw new BadRequestException('activo es requerido y debe ser booleano');
  }

  return { activo: input.activo };
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

export function parseListClientesQuery(query: unknown): ListClientesQueryDto {
  const input = requireObject(query, 'Los filtros deben ser un objeto');
  rejectUnexpectedFields(input, listFields, 'Filtro');
  const result: ListClientesQueryDto = {
    page: parsePositiveInteger(input.page, 'page', 1),
    limit: parsePositiveInteger(input.limit, 'limit', 20, 100),
  };

  if ('activo' in input) {
    if (input.activo !== 'true' && input.activo !== 'false') {
      throw new BadRequestException('activo debe ser true o false');
    }
    result.activo = input.activo === 'true';
  }

  if ('q' in input) {
    result.q = parseRequiredText(input.q, 'q', 254);
  }

  return result;
}
