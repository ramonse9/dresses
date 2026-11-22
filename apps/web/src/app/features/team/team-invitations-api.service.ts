import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { ApiClient } from '../../core/http/api-client.service';
import type {
  CreateTeamInvitationInput,
  PaginatedTeamInvitationsResponse,
  TeamInvitation,
  TeamInvitationFilters,
  TeamInvitationState,
} from './team-invitation.models';
import type { EmpresaRole } from '../../core/tenant/tenant.models';
import type { TeamPagination } from './team.models';

interface TeamInvitationWire {
  readonly id: string;
  readonly email: string;
  readonly rol: EmpresaRole;
  readonly estado: TeamInvitationState;
  readonly expiresAt: string;
  readonly lastSentAt: string | null;
  readonly sendCount: number;
  readonly createdAt: string;
}

interface PaginatedTeamInvitationsWire {
  readonly data: readonly TeamInvitationWire[];
  readonly pagination: TeamPagination;
}

@Injectable({ providedIn: 'root' })
export class TeamInvitationsApiService {
  private readonly api = inject(ApiClient);

  list(filters: TeamInvitationFilters): Observable<PaginatedTeamInvitationsResponse> {
    return this.api
      .get<PaginatedTeamInvitationsWire>('equipo/invitaciones', {
        params: {
          page: filters.page,
          limit: filters.limit,
          estado: filters.estado,
          rol: filters.rol,
          q: filters.q,
        },
      })
      .pipe(map(({ data, pagination }) => ({ data: data.map(toInvitation), pagination })));
  }

  create(input: CreateTeamInvitationInput): Observable<TeamInvitation> {
    return this.api
      .post<TeamInvitationWire, CreateTeamInvitationInput>('equipo/invitaciones', input)
      .pipe(map(toInvitation));
  }

  resend(id: string): Observable<TeamInvitation> {
    return this.api
      .post<TeamInvitationWire, Record<string, never>>(
        `equipo/invitaciones/${encodeURIComponent(id)}/reenviar`,
        {},
      )
      .pipe(map(toInvitation));
  }

  revoke(id: string): Observable<TeamInvitation> {
    return this.api
      .delete<TeamInvitationWire>(`equipo/invitaciones/${encodeURIComponent(id)}`)
      .pipe(map(toInvitation));
  }
}

function toInvitation(input: TeamInvitationWire): TeamInvitation {
  return {
    id: input.id,
    email: input.email,
    rol: input.rol,
    estado: input.estado,
    expiresAt: input.expiresAt,
    lastSentAt: input.lastSentAt,
    sendCount: input.sendCount,
    createdAt: input.createdAt,
  };
}
