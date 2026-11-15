import { BadRequestException } from '@nestjs/common';
import {
  parseOptionalVestidoText,
  parseRequiredVestidoText,
  parseVestidoEstadoOperativo,
  parseVestidoMoney,
} from './create-vestido.dto.js';
import type { VestidoEstadoOperativo } from '../entities/vestido.tenant-entity.js';

export type UpdateVestidoDto = {
  sucursalId?: string;
  codigo?: string;
  nombre?: string;
  descripcion?: string | null;
  talla?: string;
  color?: string;
  marca?: string | null;
  precioRenta?: string;
  deposito?: string | null;
  estadoOperativo?: VestidoEstadoOperativo;
  activo?: boolean;
};

const updateFields = new Set([
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
  'activo',
]);
const uuidV4Pattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireObject(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new BadRequestException(
      'El cuerpo de la solicitud debe ser un objeto',
    );
  }

  return body as Record<string, unknown>;
}

export function parseUpdateVestidoBody(body: unknown): UpdateVestidoDto {
  const input = requireObject(body);
  const unexpectedField = Object.keys(input).find(
    (field) => !updateFields.has(field),
  );

  if (unexpectedField) {
    throw new BadRequestException(`Campo no permitido: ${unexpectedField}`);
  }

  if (Object.keys(input).length === 0) {
    throw new BadRequestException(
      'Se requiere al menos un campo para actualizar',
    );
  }

  const result: UpdateVestidoDto = {};

  if ('sucursalId' in input) {
    if (
      typeof input.sucursalId !== 'string' ||
      !uuidV4Pattern.test(input.sucursalId)
    ) {
      throw new BadRequestException('sucursalId debe ser un UUID válido');
    }
    result.sucursalId = input.sucursalId.toLowerCase();
  }
  if ('codigo' in input) {
    result.codigo = parseRequiredVestidoText(
      input.codigo,
      'codigo',
      50,
    ).toUpperCase();
  }
  if ('nombre' in input) {
    result.nombre = parseRequiredVestidoText(input.nombre, 'nombre', 160);
  }
  if ('descripcion' in input) {
    result.descripcion = parseOptionalVestidoText(
      input.descripcion,
      'descripcion',
      1_000,
    );
  }
  if ('talla' in input) {
    result.talla = parseRequiredVestidoText(input.talla, 'talla', 30);
  }
  if ('color' in input) {
    result.color = parseRequiredVestidoText(input.color, 'color', 80);
  }
  if ('marca' in input) {
    result.marca = parseOptionalVestidoText(input.marca, 'marca', 100);
  }
  if ('precioRenta' in input) {
    result.precioRenta = parseVestidoMoney(input.precioRenta, 'precioRenta');
  }
  if ('deposito' in input) {
    result.deposito =
      input.deposito === null
        ? null
        : parseVestidoMoney(input.deposito, 'deposito');
  }
  if ('estadoOperativo' in input) {
    if (input.estadoOperativo === undefined) {
      throw new BadRequestException('estadoOperativo inválido');
    }
    result.estadoOperativo = parseVestidoEstadoOperativo(input.estadoOperativo);
  }
  if ('activo' in input) {
    if (typeof input.activo !== 'boolean') {
      throw new BadRequestException('activo debe ser booleano');
    }
    result.activo = input.activo;
  }

  return result;
}
