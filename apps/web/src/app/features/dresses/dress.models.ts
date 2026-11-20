import type { ApiError } from '../../core/http/api-error';

export const DRESS_OPERATIONAL_STATES = ['DISPONIBLE', 'MANTENIMIENTO'] as const;

export type DressOperationalState = (typeof DRESS_OPERATIONAL_STATES)[number];

export interface DressBranch {
  readonly id: string;
  readonly nombre: string;
  readonly activo: boolean;
}

export interface Dress {
  readonly id: string;
  readonly sucursalId: string;
  readonly codigo: string;
  readonly nombre: string;
  readonly descripcion: string | null;
  readonly talla: string;
  readonly color: string;
  readonly marca: string | null;
  readonly precioRenta: string;
  readonly deposito: string | null;
  readonly estadoOperativo: DressOperationalState;
  readonly activo: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly sucursal: DressBranch;
}

export interface DressFormValue {
  readonly sucursalId: string;
  readonly codigo: string;
  readonly nombre: string;
  readonly descripcion: string | null;
  readonly talla: string;
  readonly color: string;
  readonly marca: string | null;
  readonly precioRenta: string;
  readonly deposito: string | null;
  readonly estadoOperativo: DressOperationalState;
  readonly activo: boolean;
}

export type CreateDressInput = Omit<DressFormValue, 'activo'>;
export type UpdateDressInput = DressFormValue;
export type DressMutationResult = Omit<Dress, 'sucursal'>;

export interface DressPagination {
  readonly page: number;
  readonly limit: number;
  readonly total: number;
  readonly totalPages: number;
}

export interface PaginatedDressesResponse {
  readonly data: Dress[];
  readonly pagination: DressPagination;
}

export interface DressListFilters {
  readonly page: number;
  readonly limit: number;
  readonly sucursalId?: string;
  readonly activo?: boolean;
  readonly estadoOperativo?: DressOperationalState;
  readonly q?: string;
}

export const DRESS_LOAD_STATES = ['idle', 'loading', 'loaded', 'empty', 'error'] as const;

export type DressLoadState = (typeof DRESS_LOAD_STATES)[number];

export interface DressListState {
  readonly status: DressLoadState;
  readonly data: readonly Dress[];
  readonly pagination: DressPagination;
  readonly filters: DressListFilters;
  readonly error: ApiError | null;
}

export interface DressDetailState {
  readonly status: DressLoadState;
  readonly data: Dress | null;
  readonly error: ApiError | null;
}
