import type { ApiError } from '../../core/http/api-error';

export interface Customer {
  readonly id: string;
  readonly nombre: string;
  readonly telefono: string | null;
  readonly email: string | null;
  readonly direccion: string | null;
  readonly notas: string | null;
  readonly activo: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CustomerPagination {
  readonly page: number;
  readonly limit: number;
  readonly total: number;
  readonly totalPages: number;
}

export interface PaginatedCustomersResponse {
  readonly data: Customer[];
  readonly pagination: CustomerPagination;
}

export interface CustomerListFilters {
  readonly page: number;
  readonly limit: number;
  readonly activo?: boolean;
  readonly q?: string;
}

export interface CreateCustomerInput {
  readonly nombre: string;
  readonly telefono: string | null;
  readonly email: string | null;
  readonly direccion: string | null;
  readonly notas: string | null;
}

export type UpdateCustomerInput = CreateCustomerInput;

export const CUSTOMER_LOAD_STATES = ['idle', 'loading', 'loaded', 'empty', 'error'] as const;

export type CustomerLoadState = (typeof CUSTOMER_LOAD_STATES)[number];

export interface CustomerListState {
  readonly status: CustomerLoadState;
  readonly data: readonly Customer[];
  readonly pagination: CustomerPagination;
  readonly filters: CustomerListFilters;
  readonly error: ApiError | null;
}

export interface CustomerDetailState {
  readonly status: CustomerLoadState;
  readonly data: Customer | null;
  readonly error: ApiError | null;
}
