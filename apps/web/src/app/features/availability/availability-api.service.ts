import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiClient } from '../../core/http/api-client.service';
import type { AvailabilityFilters, AvailabilityResponse } from './availability.models';

@Injectable({ providedIn: 'root' })
export class AvailabilityApiService {
  private readonly api = inject(ApiClient);

  find(filters: AvailabilityFilters): Observable<AvailabilityResponse> {
    return this.api.get<AvailabilityResponse>('vestidos/disponibilidad', {
      params: {
        sucursalId: filters.sucursalId,
        fechaInicio: filters.fechaInicio,
        fechaFin: filters.fechaFin,
        talla: filters.talla,
        color: filters.color,
        estadoOperativo: filters.estadoOperativo,
        page: filters.page,
        limit: filters.limit,
      },
    });
  }
}
