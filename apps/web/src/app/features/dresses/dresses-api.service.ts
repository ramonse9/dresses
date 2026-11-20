import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiClient } from '../../core/http/api-client.service';
import type {
  CreateDressInput,
  Dress,
  DressListFilters,
  DressMutationResult,
  PaginatedDressesResponse,
  UpdateDressInput,
} from './dress.models';

@Injectable({ providedIn: 'root' })
export class DressesApiService {
  private readonly api = inject(ApiClient);

  list(filters: DressListFilters): Observable<PaginatedDressesResponse> {
    return this.api.get<PaginatedDressesResponse>('vestidos', {
      params: {
        page: filters.page,
        limit: filters.limit,
        sucursalId: filters.sucursalId,
        activo: filters.activo,
        estadoOperativo: filters.estadoOperativo,
        q: filters.q,
      },
    });
  }

  getById(id: string): Observable<Dress> {
    return this.api.get<Dress>(`vestidos/${encodeURIComponent(id)}`);
  }

  create(input: CreateDressInput): Observable<DressMutationResult> {
    return this.api.post<DressMutationResult, CreateDressInput>('vestidos', input);
  }

  update(
    id: string,
    input: UpdateDressInput | { readonly activo: true },
  ): Observable<DressMutationResult> {
    return this.api.patch<DressMutationResult, UpdateDressInput | { readonly activo: true }>(
      `vestidos/${encodeURIComponent(id)}`,
      input,
    );
  }

  deactivate(id: string): Observable<DressMutationResult> {
    return this.api.delete<DressMutationResult>(`vestidos/${encodeURIComponent(id)}`);
  }
}
