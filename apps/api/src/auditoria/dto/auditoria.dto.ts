import { BadRequestException } from '@nestjs/common';
import {
  AUDIT_ACTIONS,
  AUDIT_RESOURCE_TYPES,
  type AuditAction,
  type AuditResourceType,
} from '../../audit/audit.constants.js';

export type ListAuditEventsQueryDto = {
  page: number;
  limit: number;
  action?: AuditAction;
  resourceType?: AuditResourceType;
  resourceId?: string;
  actorUsuarioId?: string;
  fechaDesde?: Date;
  fechaHasta?: Date;
};

export type AuditActorResponseDto = {
  id: string;
  nombre: string | null;
  email: string | null;
  activo: boolean | null;
};

export type AuditEventResponseDto = {
  id: string;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId: string | null;
  actor: AuditActorResponseDto | null;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
};

export type PaginatedAuditEventsResponseDto = {
  data: AuditEventResponseDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

const allowedFields = new Set([
  'page',
  'limit',
  'action',
  'resourceType',
  'resourceId',
  'actorUsuarioId',
  'fechaDesde',
  'fechaHasta',
]);
const auditActions = new Set<string>(Object.values(AUDIT_ACTIONS));
const auditResourceTypes = new Set<string>(Object.values(AUDIT_RESOURCE_TYPES));
const uuidV4Pattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isoDateTimeWithTimezonePattern =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

export function parseListAuditEventsQuery(
  query: unknown,
): ListAuditEventsQueryDto {
  if (typeof query !== 'object' || query === null || Array.isArray(query)) {
    throw new BadRequestException('Los filtros deben ser un objeto');
  }

  const input = query as Record<string, unknown>;
  const unexpected = Object.keys(input).find(
    (field) => !allowedFields.has(field),
  );

  if (unexpected) {
    throw new BadRequestException(`Filtro no permitido: ${unexpected}`);
  }

  const result: ListAuditEventsQueryDto = {
    page: parsePositiveInteger(input.page, 'page', 1),
    limit: parsePositiveInteger(input.limit, 'limit', 20, 100),
  };

  if ('action' in input) {
    if (typeof input.action !== 'string' || !auditActions.has(input.action)) {
      throw new BadRequestException('action inválida');
    }
    result.action = input.action as AuditAction;
  }
  if ('resourceType' in input) {
    if (
      typeof input.resourceType !== 'string' ||
      !auditResourceTypes.has(input.resourceType)
    ) {
      throw new BadRequestException('resourceType inválido');
    }
    result.resourceType = input.resourceType as AuditResourceType;
  }
  if ('resourceId' in input) {
    result.resourceId = parseUuid(input.resourceId, 'resourceId');
  }
  if ('actorUsuarioId' in input) {
    result.actorUsuarioId = parseUuid(input.actorUsuarioId, 'actorUsuarioId');
  }
  if ('fechaDesde' in input) {
    result.fechaDesde = parseDate(input.fechaDesde, 'fechaDesde');
  }
  if ('fechaHasta' in input) {
    result.fechaHasta = parseDate(input.fechaHasta, 'fechaHasta');
  }
  if (
    result.fechaDesde &&
    result.fechaHasta &&
    result.fechaHasta.getTime() <= result.fechaDesde.getTime()
  ) {
    throw new BadRequestException('fechaHasta debe ser posterior a fechaDesde');
  }

  return result;
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
