import { BadRequestException } from '@nestjs/common';
import { EmpresaUsuarioRol } from '../../usuarios/entities/empresa-usuario.entity.js';

export type ListMiembrosQueryDto = {
  page: number;
  limit: number;
  rol?: EmpresaUsuarioRol;
  activo?: boolean;
  q?: string;
};

export type MiembroResponseDto = {
  id: string;
  usuario: {
    id: string;
    nombre: string;
    email: string;
    activo: boolean;
  };
  rol: EmpresaUsuarioRol;
  activo: boolean;
  createdAt: Date;
};

export type PaginatedMiembrosResponseDto = {
  data: MiembroResponseDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type UpdateMiembroRolDto = {
  rol: EmpresaUsuarioRol;
};

export type UpdateMiembroEstadoDto = {
  activo: boolean;
};

const listFields = new Set(['page', 'limit', 'rol', 'activo', 'q']);

function requireObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new BadRequestException('Los filtros deben ser un objeto');
  }

  return value as Record<string, unknown>;
}

function parseSingleFieldBody(
  body: unknown,
  field: string,
): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new BadRequestException(
      'El cuerpo de la solicitud debe ser un objeto',
    );
  }

  const input = body as Record<string, unknown>;
  const fields = Object.keys(input);
  if (fields.length !== 1 || fields[0] !== field) {
    const unexpected = fields.find((candidate) => candidate !== field);
    throw new BadRequestException(
      unexpected
        ? `Campo no permitido: ${unexpected}`
        : `${field} es requerido`,
    );
  }

  return input;
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

function parseSearch(value: unknown): string {
  if (typeof value !== 'string') {
    throw new BadRequestException('q debe ser texto');
  }

  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > 254) {
    throw new BadRequestException('q debe tener entre 1 y 254 caracteres');
  }

  return normalized;
}

export function parseListMiembrosQuery(query: unknown): ListMiembrosQueryDto {
  const input = requireObject(query);
  const unexpected = Object.keys(input).find((field) => !listFields.has(field));

  if (unexpected) {
    throw new BadRequestException(`Filtro no permitido: ${unexpected}`);
  }

  const result: ListMiembrosQueryDto = {
    page: parsePositiveInteger(input.page, 'page', 1),
    limit: parsePositiveInteger(input.limit, 'limit', 20, 100),
  };

  if ('rol' in input) {
    if (
      input.rol !== EmpresaUsuarioRol.OWNER &&
      input.rol !== EmpresaUsuarioRol.EMPLOYEE
    ) {
      throw new BadRequestException('rol debe ser OWNER o EMPLOYEE');
    }
    result.rol = input.rol;
  }

  if ('activo' in input) {
    if (input.activo !== 'true' && input.activo !== 'false') {
      throw new BadRequestException('activo debe ser true o false');
    }
    result.activo = input.activo === 'true';
  }

  if ('q' in input) {
    result.q = parseSearch(input.q);
  }

  return result;
}

export function parseUpdateMiembroRolBody(body: unknown): UpdateMiembroRolDto {
  const input = parseSingleFieldBody(body, 'rol');

  if (
    input.rol !== EmpresaUsuarioRol.OWNER &&
    input.rol !== EmpresaUsuarioRol.EMPLOYEE
  ) {
    throw new BadRequestException('rol debe ser OWNER o EMPLOYEE');
  }

  return { rol: input.rol };
}

export function parseUpdateMiembroEstadoBody(
  body: unknown,
): UpdateMiembroEstadoDto {
  const input = parseSingleFieldBody(body, 'activo');

  if (typeof input.activo !== 'boolean') {
    throw new BadRequestException('activo debe ser booleano');
  }

  return { activo: input.activo };
}
