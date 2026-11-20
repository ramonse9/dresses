import type { ParamMap } from '@angular/router';
import {
  RESERVATION_STATUSES,
  type ReservationFilters,
  type ReservationStatus,
} from './reservation.models';

export const DEFAULT_RESERVATION_PAGE = 1;
export const DEFAULT_RESERVATION_LIMIT = 20;
export const MAXIMUM_RESERVATION_LIMIT = 100;
export const MAXIMUM_RESERVATION_SEARCH_LENGTH = 254;

const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isoWithTimeZonePattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;
const localDateTimePattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

export function normalizeReservationSearch(value: string): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, MAXIMUM_RESERVATION_SEARCH_LENGTH);
}

export function reservationFiltersFromParamMap(params: ParamMap): ReservationFilters {
  const clienteId = normalizeUuid(params.get('clienteId'));
  const sucursalId = normalizeUuid(params.get('sucursalId'));
  const estado = normalizeStatus(params.get('estado'));
  let fechaDesde = normalizeIso(params.get('fechaDesde'));
  let fechaHasta = normalizeIso(params.get('fechaHasta'));
  if (
    fechaDesde &&
    fechaHasta &&
    new Date(fechaHasta).getTime() <= new Date(fechaDesde).getTime()
  ) {
    fechaDesde = null;
    fechaHasta = null;
  }
  const q = normalizeReservationSearch(params.get('q') ?? '');

  return {
    page: parsePositiveInteger(params.get('page'), DEFAULT_RESERVATION_PAGE),
    limit: parsePositiveInteger(
      params.get('limit'),
      DEFAULT_RESERVATION_LIMIT,
      MAXIMUM_RESERVATION_LIMIT,
    ),
    ...(clienteId ? { clienteId } : {}),
    ...(sucursalId ? { sucursalId } : {}),
    ...(estado ? { estado } : {}),
    ...(fechaDesde ? { fechaDesde } : {}),
    ...(fechaHasta ? { fechaHasta } : {}),
    ...(q ? { q } : {}),
  };
}

export function reservationFiltersToQueryParams(
  filters: ReservationFilters,
): Record<string, string | number> {
  return {
    page: filters.page,
    limit: filters.limit,
    ...(filters.clienteId ? { clienteId: filters.clienteId } : {}),
    ...(filters.sucursalId ? { sucursalId: filters.sucursalId } : {}),
    ...(filters.estado ? { estado: filters.estado } : {}),
    ...(filters.fechaDesde ? { fechaDesde: filters.fechaDesde } : {}),
    ...(filters.fechaHasta ? { fechaHasta: filters.fechaHasta } : {}),
    ...(filters.q ? { q: filters.q } : {}),
  };
}

export function reservationLocalDateTimeToIso(value: string): string | null {
  if (!value.trim()) return null;
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

export function reservationIsoToLocalDateTime(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function normalizeUuid(value: string | null): string | null {
  return value && uuidV4Pattern.test(value) ? value.toLowerCase() : null;
}

function normalizeStatus(value: string | null): ReservationStatus | null {
  return RESERVATION_STATUSES.includes(value as ReservationStatus)
    ? (value as ReservationStatus)
    : null;
}

function normalizeIso(value: string | null): string | null {
  if (!value || !isoWithTimeZonePattern.test(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
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
