import { BadRequestException } from '@nestjs/common';
import { normalizeEmail } from '../../usuarios/email.js';

export interface LoginDto {
  email: string;
  password: string;
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseLoginBody(body: unknown): LoginDto {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new BadRequestException(
      'El cuerpo de la solicitud debe ser un objeto',
    );
  }

  const input = body as Record<string, unknown>;
  const unexpectedField = Object.keys(input).find(
    (field) => field !== 'email' && field !== 'password',
  );

  if (unexpectedField) {
    throw new BadRequestException(`Campo no permitido: ${unexpectedField}`);
  }

  if (typeof input.email !== 'string') {
    throw new BadRequestException('email es requerido');
  }

  const email = normalizeEmail(input.email);

  if (email.length === 0 || email.length > 254 || !emailPattern.test(email)) {
    throw new BadRequestException('email debe ser válido');
  }

  if (typeof input.password !== 'string') {
    throw new BadRequestException('password es requerido');
  }

  if (input.password.length < 8 || input.password.length > 1_024) {
    throw new BadRequestException(
      'password debe tener entre 8 y 1024 caracteres',
    );
  }

  return { email, password: input.password };
}
