import type { EmpresaRole } from '../../core/tenant/tenant.models';
import type { ApiError } from '../../core/http/api-error';

export interface TeamMemberUser {
  readonly id: string;
  readonly nombre: string;
  readonly email: string;
  readonly activo: boolean;
}

export interface TeamMember {
  readonly id: string;
  readonly usuario: TeamMemberUser;
  readonly rol: EmpresaRole;
  readonly activo: boolean;
  readonly createdAt: string;
}

export interface TeamPagination {
  readonly page: number;
  readonly limit: number;
  readonly total: number;
  readonly totalPages: number;
}

export interface PaginatedTeamMembersResponse {
  readonly data: readonly TeamMember[];
  readonly pagination: TeamPagination;
}

export interface TeamListFilters {
  readonly page: number;
  readonly limit: number;
  readonly rol?: EmpresaRole;
  readonly activo?: boolean;
  readonly q?: string;
}

export type TeamLoadState = 'idle' | 'loading' | 'loaded' | 'empty' | 'error';

export interface TeamListState {
  readonly status: TeamLoadState;
  readonly data: readonly TeamMember[];
  readonly pagination: TeamPagination;
  readonly filters: TeamListFilters;
  readonly error: ApiError | null;
}

export interface TeamDetailState {
  readonly status: TeamLoadState;
  readonly data: TeamMember | null;
  readonly error: ApiError | null;
}
