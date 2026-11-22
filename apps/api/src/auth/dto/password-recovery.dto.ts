import { BadRequestException } from '@nestjs/common';
import { normalizeEmail } from '../../usuarios/email.js';

export interface RequestPasswordRecoveryDto {
  email: string;
}

export interface ResetPasswordDto {
  token: string;
  password: string;
}

export interface PasswordRecoveryPublicResponseDto {
  message: string;
}

export const PASSWORD_RECOVERY_REQUEST_MESSAGE =
  'Si la cuenta existe y está activa, recibirás instrucciones por correo.';
export const PASSWORD_RESET_INVALID_MESSAGE =
  'El enlace de recuperación no es válido o ya no está disponible';
export const PASSWORD_RESET_SUCCESS_MESSAGE =
  'Contraseña restablecida. Ya puedes iniciar sesión.';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const tokenPattern = /^[A-Za-z0-9_-]{32,512}$/;

export function parseRequestPasswordRecoveryBody(
  body: unknown,
): RequestPasswordRecoveryDto {
  const input = parseObject(body, ['email']);
  if (typeof input.email !== 'string') {
    throw new BadRequestException('email es requerido');
  }
  const email = normalizeEmail(input.email);
  if (email.length === 0 || email.length > 254 || !emailPattern.test(email)) {
    throw new BadRequestException('email debe ser válido');
  }
  return { email };
}

export function parseResetPasswordBody(body: unknown): ResetPasswordDto {
  const input = parseObject(body, ['token', 'password']);
  if (typeof input.token !== 'string' || !tokenPattern.test(input.token)) {
    throw new BadRequestException(PASSWORD_RESET_INVALID_MESSAGE);
  }
  if (typeof input.password !== 'string') {
    throw new BadRequestException('password es requerido');
  }
  if (input.password.length < 8 || input.password.length > 1_024) {
    throw new BadRequestException(
      'password debe tener entre 8 y 1024 caracteres',
    );
  }
  return { token: input.token, password: input.password };
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
