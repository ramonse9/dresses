import type { ApiError } from '../../core/http/api-error';

export const RESERVATION_STATUSES = [
  'BORRADOR',
  'CONFIRMADA',
  'ENTREGADA',
  'DEVUELTA',
  'CANCELADA',
] as const;

export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export interface ReservationCustomer {
  readonly id: string;
  readonly nombre: string;
  readonly telefono: string | null;
  readonly email: string | null;
}

export interface ReservationBranch {
  readonly id: string;
  readonly nombre: string;
}

export interface ReservationDressSnapshot {
  readonly id: string;
  readonly codigo: string;
  readonly nombre: string;
  readonly talla: string;
  readonly color: string;
  readonly precioRenta: string;
  readonly deposito: string;
}

export interface ReservationListItem {
  readonly id: string;
  readonly cliente: ReservationCustomer;
  readonly sucursal: ReservationBranch;
  readonly fechaInicio: string;
  readonly fechaFin: string;
  readonly estado: ReservationStatus;
  readonly notas: string | null;
  readonly importeRenta: string;
  readonly depositoRequerido: string;
  readonly vestidosCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ReservationDetail extends Omit<ReservationListItem, 'vestidosCount'> {
  readonly vestidos: readonly ReservationDressSnapshot[];
  readonly confirmadaAt: string | null;
  readonly entregadaAt: string | null;
  readonly devueltaAt: string | null;
  readonly canceladaAt: string | null;
  readonly motivoCancelacion: string | null;
}

export interface CreateReservationInput {
  readonly clienteId: string;
  readonly sucursalId: string;
  readonly vestidoIds: readonly string[];
  readonly fechaInicio: string;
  readonly fechaFin: string;
  readonly notas: string | null;
  readonly confirmar: boolean;
}

export interface ReservationFilters {
  readonly page: number;
  readonly limit: number;
  readonly clienteId?: string;
  readonly sucursalId?: string;
  readonly estado?: ReservationStatus;
  readonly fechaDesde?: string;
  readonly fechaHasta?: string;
  readonly q?: string;
}

export interface ReservationPagination {
  readonly page: number;
  readonly limit: number;
  readonly total: number;
  readonly totalPages: number;
}

export interface PaginatedReservationsResponse {
  readonly data: ReservationListItem[];
  readonly pagination: ReservationPagination;
}

export const RESERVATION_LOAD_STATES = ['idle', 'loading', 'loaded', 'empty', 'error'] as const;
export type ReservationLoadState = (typeof RESERVATION_LOAD_STATES)[number];

export interface ReservationListState {
  readonly status: ReservationLoadState;
  readonly data: readonly ReservationListItem[];
  readonly pagination: ReservationPagination;
  readonly filters: ReservationFilters;
  readonly error: ApiError | null;
}

export interface ReservationDetailState {
  readonly status: ReservationLoadState;
  readonly data: ReservationDetail | null;
  readonly error: ApiError | null;
}
