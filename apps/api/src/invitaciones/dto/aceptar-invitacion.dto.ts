import { BadRequestException } from '@nestjs/common';
import type { EmpresaUsuarioRol } from '../../usuarios/entities/empresa-usuario.entity.js';

export interface VerificarInvitacionDto {
  token: string;
}

export interface AceptarInvitacionDto extends VerificarInvitacionDto {
  nombre?: string;
  password: string;
}

export interface InvitacionVerificadaResponseDto {
  empresaNombre: string;
  email: string;
  rol: EmpresaUsuarioRol;
  expiresAt: Date;
  accountExists: boolean;
}

export interface InvitacionAceptadaResponseDto {
  accepted: true;
  message: string;
}

export const INVITACION_INVALIDA_MESSAGE =
  'La invitación no es válida o ya no está disponible';

const tokenPattern = /^[A-Za-z0-9_-]{32,512}$/;

export function parseVerificarInvitacionBody(
  body: unknown,
): VerificarInvitacionDto {
  const input = parseObject(body, ['token']);
  return { token: parseToken(input.token) };
}

export function parseAceptarInvitacionBody(
  body: unknown,
): AceptarInvitacionDto {
  const input = parseObject(body, ['token', 'nombre', 'password']);
  const token = parseToken(input.token);

  if (typeof input.password !== 'string') {
    throw new BadRequestException('password es requerido');
  }
  if (input.password.length < 8 || input.password.length > 1_024) {
    throw new BadRequestException(
      'password debe tener entre 8 y 1024 caracteres',
    );
  }

  let nombre: string | undefined;
  if (input.nombre !== undefined) {
    if (typeof input.nombre !== 'string') {
      throw new BadRequestException('nombre debe ser texto');
    }
    nombre = input.nombre.trim();
    if (nombre.length === 0 || nombre.length > 160) {
      throw new BadRequestException(
        'nombre debe tener entre 1 y 160 caracteres',
      );
    }
  }

  return { token, password: input.password, nombre };
}

function parseToken(value: unknown): string {
  if (typeof value !== 'string' || !tokenPattern.test(value)) {
    throw new BadRequestException(INVITACION_INVALIDA_MESSAGE);
  }
  return value;
}

function parseObject(
  body: unknown,
  allowedFields: readonly string[],
): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new BadRequestException(
      'El cuerpo de la solicitud debe ser un objeto',
    );
  }

  const input = body as Record<string, unknown>;
  const unexpectedField = Object.keys(input).find(
    (field) => !allowedFields.includes(field),
  );
  if (unexpectedField) {
    throw new BadRequestException(`Campo no permitido: ${unexpectedField}`);
  }
  return input;
}
