import { BadRequestException } from '@nestjs/common';

export type CreateReservacionDto = {
  clienteId: string;
  sucursalId: string;
  vestidoIds: string[];
  fechaInicio: Date;
  fechaFin: Date;
  notas?: string | null;
  confirmar: boolean;
};

const allowedFields = new Set([
  'clienteId',
  'sucursalId',
  'vestidoIds',
  'fechaInicio',
  'fechaFin',
  'notas',
  'confirmar',
]);
const uuidV4Pattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isoDateTimeWithTimezonePattern =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

function requireObject(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new BadRequestException(
      'El cuerpo de la solicitud debe ser un objeto',
    );
  }

  return body as Record<string, unknown>;
}

function parseUuid(value: unknown, field: string): string {
  if (typeof value !== 'string' || !uuidV4Pattern.test(value)) {
    throw new BadRequestException(`${field} debe ser un UUID válido`);
  }

  return value.toLowerCase();
}

function parseDate(value: unknown, field: string): Date {
  const rawValue = typeof value === 'string' ? value : null;
  const match = rawValue ? isoDateTimeWithTimezonePattern.exec(rawValue) : null;

  if (!match) {
    throw new BadRequestException(
      `${field} debe ser una fecha ISO 8601 con zona horaria`,
    );
  }

  const [, yearRaw, monthRaw, dayRaw, hourRaw, minuteRaw, secondRaw] = match;
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  const second = Number(secondRaw);
  const maximumDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > maximumDay ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    throw new BadRequestException(`${field} no es una fecha válida`);
  }

  const parsed = new Date(match[0]);

  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`${field} no es una fecha válida`);
  }

  return parsed;
}

export function parseCreateReservacionBody(
  body: unknown,
): CreateReservacionDto {
  const input = requireObject(body);
  const unexpected = Object.keys(input).find(
    (field) => !allowedFields.has(field),
  );

  if (unexpected) {
    throw new BadRequestException(`Campo no permitido: ${unexpected}`);
  }
  if (!Array.isArray(input.vestidoIds)) {
    throw new BadRequestException('vestidoIds debe ser una lista');
  }
  if (input.vestidoIds.length < 1 || input.vestidoIds.length > 50) {
    throw new BadRequestException(
      'vestidoIds debe contener entre 1 y 50 elementos',
    );
  }

  const vestidoIds = input.vestidoIds.map((id, index) =>
    parseUuid(id, `vestidoIds[${index}]`),
  );

  if (new Set(vestidoIds).size !== vestidoIds.length) {
    throw new BadRequestException('vestidoIds no puede contener duplicados');
  }

  const fechaInicio = parseDate(input.fechaInicio, 'fechaInicio');
  const fechaFin = parseDate(input.fechaFin, 'fechaFin');

  if (fechaFin.getTime() <= fechaInicio.getTime()) {
    throw new BadRequestException('fechaFin debe ser posterior a fechaInicio');
  }

  let notas: string | null | undefined;

  if ('notas' in input) {
    if (input.notas !== null && typeof input.notas !== 'string') {
      throw new BadRequestException('notas debe ser texto o null');
    }

    const normalized =
      typeof input.notas === 'string' ? input.notas.trim() : null;

    if (normalized !== null && normalized.length > 2_000) {
      throw new BadRequestException('notas no puede exceder 2000 caracteres');
    }
    notas = normalized?.length ? normalized : null;
  }

  if ('confirmar' in input && typeof input.confirmar !== 'boolean') {
    throw new BadRequestException('confirmar debe ser booleano');
  }

  return {
    clienteId: parseUuid(input.clienteId, 'clienteId'),
    sucursalId: parseUuid(input.sucursalId, 'sucursalId'),
    vestidoIds,
    fechaInicio,
    fechaFin,
    ...(notas !== undefined ? { notas } : {}),
    confirmar: input.confirmar !== false,
  };
}
