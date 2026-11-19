import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiClient } from '../../core/http/api-client.service';
import type { Customer, CustomerListFilters, PaginatedCustomersResponse } from './customer.models';

@Injectable({ providedIn: 'root' })
export class CustomersApiService {
  private readonly api = inject(ApiClient);

  list(filters: CustomerListFilters): Observable<PaginatedCustomersResponse> {
    return this.api.get<PaginatedCustomersResponse>('clientes', {
      params: {
        page: filters.page,
        limit: filters.limit,
        activo: filters.activo,
        q: filters.q,
      },
    });
  }

  getById(id: string): Observable<Customer> {
    return this.api.get<Customer>(`clientes/${encodeURIComponent(id)}`);
  }
}
