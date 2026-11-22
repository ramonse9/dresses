import type { ParamMap } from '@angular/router';
import type { EmpresaRole } from '../../core/tenant/tenant.models';
import {
  TEAM_INVITATION_STATES,
  type TeamInvitationFilters,
  type TeamInvitationState,
} from './team-invitation.models';

export const DEFAULT_INVITATION_PAGE = 1;
export const DEFAULT_INVITATION_LIMIT = 20;
export const MAXIMUM_INVITATION_LIMIT = 100;
export const MAXIMUM_INVITATION_SEARCH_LENGTH = 254;

export function normalizeInvitationSearch(value: string): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, MAXIMUM_INVITATION_SEARCH_LENGTH);
}

export function invitationFiltersFromParamMap(params: ParamMap): TeamInvitationFilters {
  const page = parsePositiveInteger(params.get('page'), DEFAULT_INVITATION_PAGE);
  const limit = parsePositiveInteger(
    params.get('limit'),
    DEFAULT_INVITATION_LIMIT,
    MAXIMUM_INVITATION_LIMIT,
  );
  const estado = params.get('estado');
  const rol = params.get('rol');
  const q = normalizeInvitationSearch(params.get('q') ?? '');

  return {
    page,
    limit,
    ...(isInvitationState(estado) ? { estado } : {}),
    ...(isRole(rol) ? { rol } : {}),
    ...(q ? { q } : {}),
  };
}

export function invitationFiltersToQueryParams(
  filters: TeamInvitationFilters,
): Record<string, string | number> {
  return {
    page: filters.page,
    limit: filters.limit,
    ...(filters.estado ? { estado: filters.estado } : {}),
    ...(filters.rol ? { rol: filters.rol } : {}),
    ...(filters.q ? { q: filters.q } : {}),
  };
}

function isInvitationState(value: string | null): value is TeamInvitationState {
  return TEAM_INVITATION_STATES.some((state) => state === value);
}

function isRole(value: string | null): value is EmpresaRole {
  return value === 'OWNER' || value === 'EMPLOYEE';
}

function parsePositiveInteger(value: string | null, fallback: number, maximum?: number): number {
  if (!value || !/^[1-9]\d*$/.test(value)) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && (maximum === undefined || parsed <= maximum)
    ? parsed
    : fallback;
}
