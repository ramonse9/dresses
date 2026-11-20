import type { ApiError } from '../../core/http/api-error';
import type {
  Dress,
  DressLoadState,
  DressOperationalState,
  DressPagination,
} from '../dresses/dress.models';

export interface AvailabilityFilters {
  readonly sucursalId: string;
  readonly fechaInicio: string;
  readonly fechaFin: string;
  readonly talla?: string;
  readonly color?: string;
  readonly estadoOperativo: DressOperationalState;
  readonly page: number;
  readonly limit: number;
}

export interface AvailabilityResponse {
  readonly data: Dress[];
  readonly pagination: DressPagination;
  readonly range: {
    readonly fechaInicio: string;
    readonly fechaFin: string;
  };
}

export interface AvailabilityState {
  readonly status: DressLoadState;
  readonly data: readonly Dress[];
  readonly pagination: DressPagination;
  readonly range: AvailabilityResponse['range'] | null;
  readonly filters: AvailabilityFilters | null;
  readonly error: ApiError | null;
}
