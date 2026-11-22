import { BadRequestException } from '@nestjs/common';
import { normalizeEmail } from '../../usuarios/email.js';
import { EmpresaUsuarioRol } from '../../usuarios/entities/empresa-usuario.entity.js';
import { EmpresaInvitacionEstado } from '../entities/empresa-invitacion.entity.js';

export type CreateInvitacionDto = {
  email: string;
  rol: EmpresaUsuarioRol;
};

export type ListInvitacionesQueryDto = {
  page: number;
  limit: number;
  estado?: EmpresaInvitacionEstado;
  rol?: EmpresaUsuarioRol;
  q?: string;
};

export type InvitacionResponseDto = {
  id: string;
  empresaId: string;
  email: string;
  rol: EmpresaUsuarioRol;
  estado: EmpresaInvitacionEstado;
  expiresAt: Date;
  acceptedAt: Date | null;
  acceptedByUsuarioId: string | null;
  revokedAt: Date | null;
  createdByUsuarioId: string;
  lastSentAt: Date | null;
  sendCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type PaginatedInvitacionesResponseDto = {
  data: InvitacionResponseDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

const createFields = new Set(['email', 'rol']);
const listFields = new Set(['page', 'limit', 'estado', 'rol', 'q']);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseCreateInvitacionBody(body: unknown): CreateInvitacionDto {
  const input = requireObject(
    body,
    'El cuerpo de la solicitud debe ser un objeto',
  );
  rejectUnknownFields(input, createFields, 'Campo');

  if (typeof input.email !== 'string') {
    throw new BadRequestException('email es requerido');
  }
  const email = normalizeEmail(input.email);
  if (email.length === 0 || email.length > 254 || !emailPattern.test(email)) {
    throw new BadRequestException('email debe ser válido');
  }

  if (
    input.rol !== EmpresaUsuarioRol.OWNER &&
    input.rol !== EmpresaUsuarioRol.EMPLOYEE
  ) {
    throw new BadRequestException('rol debe ser OWNER o EMPLOYEE');
  }

  return { email, rol: input.rol };
}

export function parseListInvitacionesQuery(
  query: unknown,
): ListInvitacionesQueryDto {
  const input = requireObject(query, 'Los filtros deben ser un objeto');
  rejectUnknownFields(input, listFields, 'Filtro');
  const result: ListInvitacionesQueryDto = {
    page: parsePositiveInteger(input.page, 'page', 1),
    limit: parsePositiveInteger(input.limit, 'limit', 20, 100),
  };

  if ('estado' in input) {
    if (
      !Object.values(EmpresaInvitacionEstado).includes(input.estado as never)
    ) {
      throw new BadRequestException(
        'estado debe ser PENDIENTE, EXPIRADA, ACEPTADA o REVOCADA',
      );
    }
    result.estado = input.estado as EmpresaInvitacionEstado;
  }
  if ('rol' in input) {
    if (
      input.rol !== EmpresaUsuarioRol.OWNER &&
      input.rol !== EmpresaUsuarioRol.EMPLOYEE
    ) {
      throw new BadRequestException('rol debe ser OWNER o EMPLOYEE');
    }
    result.rol = input.rol;
  }
  if ('q' in input) {
    if (typeof input.q !== 'string') {
      throw new BadRequestException('q debe ser texto');
    }
    const q = input.q.trim().toLowerCase();
    if (q.length === 0 || q.length > 254) {
      throw new BadRequestException('q debe tener entre 1 y 254 caracteres');
    }
    result.q = q;
  }

  return result;
}

export function assertEmptyInvitacionBody(body: unknown): void {
  if (body === undefined || body === null) {
    return;
  }
  const input = requireObject(
    body,
    'El cuerpo de la solicitud debe ser un objeto vacío',
  );
  const field = Object.keys(input)[0];
  if (field !== undefined) {
    throw new BadRequestException(`Campo no permitido: ${field}`);
  }
}

function requireObject(
  value: unknown,
  message: string,
): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new BadRequestException(message);
  }
  return value as Record<string, unknown>;
}

function rejectUnknownFields(
  input: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  prefix: string,
): void {
  const unexpected = Object.keys(input).find((field) => !allowed.has(field));
  if (unexpected) {
    throw new BadRequestException(`${prefix} no permitido: ${unexpected}`);
  }
}

function parsePositiveInteger(
  value: unknown,
  field: string,
  fallback: number,
  maximum?: number,
): number {
  if (value === undefined) {
    return fallback;
  }
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    throw new BadRequestException(`${field} debe ser un entero positivo`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || (maximum && parsed > maximum)) {
    throw new BadRequestException(
      maximum
        ? `${field} no puede ser mayor que ${maximum}`
        : `${field} debe ser un entero positivo`,
    );
  }
  return parsed;
}
