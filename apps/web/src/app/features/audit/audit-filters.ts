import type { ParamMap } from '@angular/router';
import {
  AUDIT_ACTIONS,
  AUDIT_RESOURCE_TYPES,
  type AuditAction,
  type AuditListFilters,
  type AuditResourceType,
} from './audit.models';

export const DEFAULT_AUDIT_PAGE = 1;
export const DEFAULT_AUDIT_LIMIT = 20;
export const MAXIMUM_AUDIT_LIMIT = 100;
export const AUDIT_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const localDateTimePattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

export function auditFiltersFromParamMap(params: ParamMap): AuditListFilters {
  const action = normalizeIncluded(params.get('action'), AUDIT_ACTIONS);
  const resourceType = normalizeIncluded(params.get('resourceType'), AUDIT_RESOURCE_TYPES);
  const resourceId = normalizeUuid(params.get('resourceId'));
  const actor = normalizeUuid(params.get('actor'));
  let fechaDesde = normalizeIso(params.get('fechaDesde'));
  let fechaHasta = normalizeIso(params.get('fechaHasta'));
  if (fechaDesde && fechaHasta && Date.parse(fechaHasta) <= Date.parse(fechaDesde)) {
    fechaDesde = null;
    fechaHasta = null;
  }

  return {
    page: parsePositiveInteger(params.get('page'), DEFAULT_AUDIT_PAGE),
    limit: parsePositiveInteger(params.get('limit'), DEFAULT_AUDIT_LIMIT, MAXIMUM_AUDIT_LIMIT),
    ...(action ? { action: action as AuditAction } : {}),
    ...(resourceType ? { resourceType: resourceType as AuditResourceType } : {}),
    ...(resourceId ? { resourceId } : {}),
    ...(actor ? { actor } : {}),
    ...(fechaDesde ? { fechaDesde } : {}),
    ...(fechaHasta ? { fechaHasta } : {}),
  };
}

export function auditFiltersToQueryParams(
  filters: AuditListFilters,
): Record<string, string | number> {
  return {
    page: filters.page,
    limit: filters.limit,
    ...(filters.action ? { action: filters.action } : {}),
    ...(filters.resourceType ? { resourceType: filters.resourceType } : {}),
    ...(filters.resourceId ? { resourceId: filters.resourceId } : {}),
    ...(filters.actor ? { actor: filters.actor } : {}),
    ...(filters.fechaDesde ? { fechaDesde: filters.fechaDesde } : {}),
    ...(filters.fechaHasta ? { fechaHasta: filters.fechaHasta } : {}),
  };
}

export function auditLocalDateTimeToIso(value: string): string | null {
  const match = localDateTimePattern.exec(value.trim());
  if (!match) return value.trim() ? null : '';
  const [, year, month, day, hour, minute] = match;
  const date = new Date(+year, +month - 1, +day, +hour, +minute, 0, 0);
  if (
    date.getFullYear() !== +year ||
    date.getMonth() !== +month - 1 ||
    date.getDate() !== +day ||
    date.getHours() !== +hour ||
    date.getMinutes() !== +minute
  )
    return null;
  return date.toISOString();
}

export function auditIsoToLocalDateTime(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function normalizeIncluded(value: string | null, values: readonly string[]): string | null {
  return value && values.includes(value) ? value : null;
}

function normalizeUuid(value: string | null): string | null {
  return value && AUDIT_UUID_PATTERN.test(value) ? value.toLowerCase() : null;
}

function normalizeIso(value: string | null): string | null {
  if (!value) return null;
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
