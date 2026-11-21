import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiClient } from '../../core/http/api-client.service';
import type { EmpresaRole } from '../../core/tenant/tenant.models';
import type { PaginatedTeamMembersResponse, TeamListFilters, TeamMember } from './team.models';

@Injectable({ providedIn: 'root' })
export class TeamApiService {
  private readonly api = inject(ApiClient);

  list(filters: TeamListFilters): Observable<PaginatedTeamMembersResponse> {
    return this.api.get<PaginatedTeamMembersResponse>('equipo/miembros', {
      params: {
        page: filters.page,
        limit: filters.limit,
        rol: filters.rol,
        activo: filters.activo,
        q: filters.q,
      },
    });
  }

  getById(id: string): Observable<TeamMember> {
    return this.api.get<TeamMember>(`equipo/miembros/${encodeURIComponent(id)}`);
  }

  updateRole(id: string, rol: EmpresaRole): Observable<TeamMember> {
    return this.api.patch<TeamMember, { readonly rol: EmpresaRole }>(
      `equipo/miembros/${encodeURIComponent(id)}/rol`,
      { rol },
    );
  }

  updateStatus(id: string, activo: boolean): Observable<TeamMember> {
    return this.api.patch<TeamMember, { readonly activo: boolean }>(
      `equipo/miembros/${encodeURIComponent(id)}/estado`,
      { activo },
    );
  }
}
