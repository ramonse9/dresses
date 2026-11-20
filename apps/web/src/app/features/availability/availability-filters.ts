import type { ParamMap } from '@angular/router';
import type { AvailabilityFilters } from './availability.models';

export const DEFAULT_AVAILABILITY_PAGE = 1;
export const DEFAULT_AVAILABILITY_LIMIT = 20;
export const MAXIMUM_AVAILABILITY_LIMIT = 100;
export const MAXIMUM_SIZE_LENGTH = 30;
export const MAXIMUM_COLOR_LENGTH = 80;

const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isoWithTimeZonePattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;
const localDateTimePattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

export function availabilityFiltersFromParamMap(params: ParamMap): AvailabilityFilters | null {
  const sucursalId = params.get('sucursalId') ?? '';
  const fechaInicio = normalizeIsoWithTimeZone(params.get('fechaInicio'));
  const fechaFin = normalizeIsoWithTimeZone(params.get('fechaFin'));

  if (
    !uuidV4Pattern.test(sucursalId) ||
    !fechaInicio ||
    !fechaFin ||
    new Date(fechaFin).getTime() <= new Date(fechaInicio).getTime()
  ) {
    return null;
  }

  const operationalValue = params.get('estadoOperativo');
  const talla = normalizeOptionalText(params.get('talla'), MAXIMUM_SIZE_LENGTH);
  const color = normalizeOptionalText(params.get('color'), MAXIMUM_COLOR_LENGTH);

  return {
    sucursalId: sucursalId.toLowerCase(),
    fechaInicio,
    fechaFin,
    estadoOperativo: operationalValue === 'MANTENIMIENTO' ? 'MANTENIMIENTO' : 'DISPONIBLE',
    page: parsePositiveInteger(params.get('page'), DEFAULT_AVAILABILITY_PAGE),
    limit: parsePositiveInteger(
      params.get('limit'),
      DEFAULT_AVAILABILITY_LIMIT,
      MAXIMUM_AVAILABILITY_LIMIT,
    ),
    ...(talla ? { talla } : {}),
    ...(color ? { color } : {}),
  };
}

export function availabilityFiltersToQueryParams(
  filters: AvailabilityFilters,
): Record<string, string | number> {
  return {
    sucursalId: filters.sucursalId,
    fechaInicio: filters.fechaInicio,
    fechaFin: filters.fechaFin,
    estadoOperativo: filters.estadoOperativo,
    page: filters.page,
    limit: filters.limit,
    ...(filters.talla ? { talla: filters.talla } : {}),
    ...(filters.color ? { color: filters.color } : {}),
  };
}

export function localDateTimeToIso(value: string): string | null {
  const match = localDateTimePattern.exec(value.trim());
  if (!match) return null;

  const [, year, month, day, hour, minute] = match;
  const date = new Date(+year, +month - 1, +day, +hour, +minute, 0, 0);
  if (
    date.getFullYear() !== +year ||
    date.getMonth() !== +month - 1 ||
    date.getDate() !== +day ||
    date.getHours() !== +hour ||
    date.getMinutes() !== +minute
  ) {
    return null;
  }
  return date.toISOString();
}

export function isoToLocalDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function browserTimeZoneLabel(reference = new Date()): string {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'zona local del navegador';
  const totalMinutes = -reference.getTimezoneOffset();
  const sign = totalMinutes >= 0 ? '+' : '-';
  const absoluteMinutes = Math.abs(totalMinutes);
  return `${zone} (UTC${sign}${pad(Math.floor(absoluteMinutes / 60))}:${pad(absoluteMinutes % 60)})`;
}

function normalizeIsoWithTimeZone(value: string | null): string | null {
  if (!value || !isoWithTimeZonePattern.test(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeOptionalText(value: string | null, maximumLength: number): string | null {
  const normalized = value?.trim().replace(/\s+/g, ' ') ?? '';
  return normalized.length > 0 && normalized.length <= maximumLength ? normalized : null;
}

function parsePositiveInteger(value: string | null, fallback: number, maximum?: number): number {
  if (!value || !/^[1-9]\d*$/.test(value)) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && (maximum === undefined || parsed <= maximum)
    ? parsed
    : fallback;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
