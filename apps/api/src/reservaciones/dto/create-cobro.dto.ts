import { BadRequestException } from '@nestjs/common';
import {
  decimalToMinorUnits,
  minorUnitsToDecimal,
} from '../../finanzas/money.js';
import { MovimientoFinancieroMetodoPago } from '../entities/movimiento-financiero.tenant-entity.js';
import { parseReservacionUuid } from './create-reservacion.dto.js';

export enum CobroConcepto {
  RENTA = 'RENTA',
  DEPOSITO = 'DEPOSITO',
}

export type CreateCobroDto = {
  concepto: CobroConcepto;
  monto: string;
  metodoPago: MovimientoFinancieroMetodoPago;
  referencia: string | null;
  notas: string | null;
  idempotencyKey: string;
};

const allowedFields = new Set([
  'concepto',
  'monto',
  'metodoPago',
  'referencia',
  'notas',
  'idempotencyKey',
]);
const positiveMoneyPattern = /^(?:0\.\d{1,2}|[1-9]\d{0,9}(?:\.\d{1,2})?)$/;
const maximumMoneyMinorUnits = 999_999_999_999n;

export function parseCreateCobroBody(body: unknown): CreateCobroDto {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new BadRequestException(
      'El cuerpo de la solicitud debe ser un objeto',
    );
  }

  const input = body as Record<string, unknown>;
  const unexpected = Object.keys(input).find(
    (field) => !allowedFields.has(field),
  );

  if (unexpected) {
    throw new BadRequestException(`Campo no permitido: ${unexpected}`);
  }
  if (!Object.values(CobroConcepto).includes(input.concepto as CobroConcepto)) {
    throw new BadRequestException('concepto inválido');
  }
  if (
    !Object.values(MovimientoFinancieroMetodoPago).includes(
      input.metodoPago as MovimientoFinancieroMetodoPago,
    )
  ) {
    throw new BadRequestException('metodoPago inválido');
  }

  return {
    concepto: input.concepto as CobroConcepto,
    monto: parsePositiveMoney(input.monto),
    metodoPago: input.metodoPago as MovimientoFinancieroMetodoPago,
    referencia: parseOptionalText(input.referencia, 'referencia', 120),
    notas: parseOptionalText(input.notas, 'notas', 500),
    idempotencyKey: parseReservacionUuid(
      input.idempotencyKey,
      'idempotencyKey',
    ),
  };
}

function parsePositiveMoney(value: unknown): string {
  if (typeof value !== 'string' || !positiveMoneyPattern.test(value)) {
    throw new BadRequestException(
      'monto debe ser un string decimal positivo con máximo 2 decimales',
    );
  }

  const minorUnits = decimalToMinorUnits(value);

  if (minorUnits <= 0n || minorUnits > maximumMoneyMinorUnits) {
    throw new BadRequestException(
      'monto debe ser un string decimal positivo con máximo 2 decimales',
    );
  }

  return minorUnitsToDecimal(minorUnits);
}

function parseOptionalText(
  value: unknown,
  field: 'referencia' | 'notas',
  maximumLength: number,
): string | null {
  if (value === undefined || value === null) {
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
