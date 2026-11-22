import type { ApiError } from '../../core/http/api-error';
import type { EmpresaRole } from '../../core/tenant/tenant.models';
import type { TeamLoadState, TeamPagination } from './team.models';

export const TEAM_INVITATION_STATES = ['PENDIENTE', 'EXPIRADA', 'ACEPTADA', 'REVOCADA'] as const;

export type TeamInvitationState = (typeof TEAM_INVITATION_STATES)[number];

export interface TeamInvitation {
  readonly id: string;
  readonly email: string;
  readonly rol: EmpresaRole;
  readonly estado: TeamInvitationState;
  readonly expiresAt: string;
  readonly lastSentAt: string | null;
  readonly sendCount: number;
  readonly createdAt: string;
}

export interface PaginatedTeamInvitationsResponse {
  readonly data: readonly TeamInvitation[];
  readonly pagination: TeamPagination;
}

export interface TeamInvitationFilters {
  readonly page: number;
  readonly limit: number;
  readonly estado?: TeamInvitationState;
  readonly rol?: EmpresaRole;
  readonly q?: string;
}

export interface CreateTeamInvitationInput {
  readonly email: string;
  readonly rol: EmpresaRole;
}

export interface TeamInvitationListState {
  readonly status: TeamLoadState;
  readonly data: readonly TeamInvitation[];
  readonly pagination: TeamPagination;
  readonly filters: TeamInvitationFilters;
  readonly error: ApiError | null;
}
