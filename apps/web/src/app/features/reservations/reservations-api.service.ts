import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiClient } from '../../core/http/api-client.service';
import type {
  CreateReservationInput,
  PaginatedReservationsResponse,
  ReservationDetail,
  ReservationFilters,
} from './reservation.models';

@Injectable({ providedIn: 'root' })
export class ReservationsApiService {
  private readonly api = inject(ApiClient);

  list(filters: ReservationFilters): Observable<PaginatedReservationsResponse> {
    return this.api.get<PaginatedReservationsResponse>('reservaciones', {
      params: {
        page: filters.page,
        limit: filters.limit,
        clienteId: filters.clienteId,
        sucursalId: filters.sucursalId,
        estado: filters.estado,
        fechaDesde: filters.fechaDesde,
        fechaHasta: filters.fechaHasta,
        q: filters.q,
      },
    });
  }

  getById(id: string): Observable<ReservationDetail> {
    return this.api.get<ReservationDetail>(`reservaciones/${encodeURIComponent(id)}`);
  }

  create(input: CreateReservationInput): Observable<ReservationDetail> {
    return this.api.post<ReservationDetail, CreateReservationInput>('reservaciones', input);
  }
}
