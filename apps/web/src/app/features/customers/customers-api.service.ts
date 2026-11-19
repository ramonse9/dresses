import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiClient } from '../../core/http/api-client.service';
import type {
  CreateCustomerInput,
  Customer,
  CustomerListFilters,
  PaginatedCustomersResponse,
  UpdateCustomerInput,
} from './customer.models';

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

  create(input: CreateCustomerInput): Observable<Customer> {
    return this.api.post<Customer, CreateCustomerInput>('clientes', input);
  }

  update(id: string, input: UpdateCustomerInput): Observable<Customer> {
    return this.api.patch<Customer, UpdateCustomerInput>(
      `clientes/${encodeURIComponent(id)}`,
      input,
    );
  }

  updateStatus(id: string, activo: boolean): Observable<Customer> {
    return this.api.patch<Customer, { readonly activo: boolean }>(
      `clientes/${encodeURIComponent(id)}/estado`,
      { activo },
    );
  }

  deactivate(id: string): Observable<Customer> {
    return this.api.delete<Customer>(`clientes/${encodeURIComponent(id)}`);
  }
}
