import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { ApiClient } from '../../core/http/api-client.service';
import { normalizeAuditEvent } from './audit-metadata';
import type {
  AuditEvent,
  AuditListFilters,
  AuditPagination,
  PaginatedAuditEventsResponse,
} from './audit.models';

@Injectable({ providedIn: 'root' })
export class AuditApiService {
  private readonly api = inject(ApiClient);

  list(filters: AuditListFilters): Observable<PaginatedAuditEventsResponse> {
    return this.api
      .get<unknown>('auditoria', {
        params: {
          page: filters.page,
          limit: filters.limit,
          action: filters.action,
          resourceType: filters.resourceType,
          resourceId: filters.resourceId,
          actorUsuarioId: filters.actor,
          fechaDesde: filters.fechaDesde,
          fechaHasta: filters.fechaHasta,
        },
      })
      .pipe(map(normalizePage));
  }

  getById(id: string): Observable<AuditEvent> {
    return this.api
      .get<unknown>(`auditoria/${encodeURIComponent(id)}`)
      .pipe(map(normalizeAuditEvent));
  }
}

function normalizePage(value: unknown): PaginatedAuditEventsResponse {
  if (!isRecord(value) || !Array.isArray(value['data'])) {
    throw new Error('La respuesta paginada de auditoría no es válida.');
  }
  return {
    data: value['data'].map(normalizeAuditEvent),
    pagination: normalizePagination(value['pagination']),
  };
}

function normalizePagination(value: unknown): AuditPagination {
  if (!isRecord(value)) throw new Error('La paginación de auditoría no es válida.');
  const page = requireNonNegativeInteger(value['page'], true);
  const limit = requireNonNegativeInteger(value['limit'], true);
  const total = requireNonNegativeInteger(value['total']);
  const totalPages = requireNonNegativeInteger(value['totalPages']);
  return { page, limit, total, totalPages };
}

function requireNonNegativeInteger(value: unknown, positive = false): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < (positive ? 1 : 0)) {
    throw new Error('La paginación de auditoría no es válida.');
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
