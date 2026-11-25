import type { ApiError } from '../../core/http/api-error';

export const AUDIT_ACTIONS = [
  'auth.login.succeeded',
  'auth.logout',
  'membership.role.changed',
  'membership.activated',
  'membership.deactivated',
  'invitation.created',
  'invitation.resent',
  'invitation.revoked',
  'invitation.accepted',
  'password.reset.completed',
  'session.revoked',
  'session.others.revoked',
  'branch.created',
  'branch.updated',
  'branch.activated',
  'branch.deactivated',
  'customer.created',
  'customer.updated',
  'customer.activated',
  'customer.deactivated',
  'dress.created',
  'dress.updated',
  'dress.transferred',
  'dress.activated',
  'dress.deactivated',
  'dress.operational_status.changed',
  'reservation.created',
  'reservation.updated',
  'reservation.confirmed',
  'reservation.delivered',
  'reservation.returned',
  'reservation.cancelled',
  'tenant.resource.created',
  'tenant.resource.updated',
  'tenant.resource.deactivated',
  'tenant.resource.state.changed',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_RESOURCE_TYPES = [
  'auth_session',
  'usuario',
  'empresa_usuario',
  'empresa_invitacion',
  'sucursal',
  'cliente',
  'vestido',
  'reservacion',
] as const;

export type AuditResourceType = (typeof AUDIT_RESOURCE_TYPES)[number];

export interface AuditActor {
  readonly id: string;
  readonly nombre: string | null;
  readonly email: string | null;
  readonly activo: boolean | null;
}

export type SafeAuditMetadata = Readonly<Record<string, unknown>>;

export interface AuditEvent {
  readonly id: string;
  readonly action: AuditAction;
  readonly resourceType: AuditResourceType;
  readonly resourceId: string | null;
  readonly actor: AuditActor | null;
  readonly metadata: SafeAuditMetadata;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  readonly createdAt: string;
}

export interface AuditPagination {
  readonly page: number;
  readonly limit: number;
  readonly total: number;
  readonly totalPages: number;
}

export interface PaginatedAuditEventsResponse {
  readonly data: readonly AuditEvent[];
  readonly pagination: AuditPagination;
}

export interface AuditListFilters {
  readonly page: number;
  readonly limit: number;
  readonly action?: AuditAction;
  readonly resourceType?: AuditResourceType;
  readonly resourceId?: string;
  readonly actor?: string;
  readonly fechaDesde?: string;
  readonly fechaHasta?: string;
}

export type AuditLoadStatus = 'idle' | 'loading' | 'loaded' | 'empty' | 'error';

export interface AuditListState {
  readonly status: AuditLoadStatus;
  readonly data: readonly AuditEvent[];
  readonly pagination: AuditPagination;
  readonly filters: AuditListFilters;
  readonly error: ApiError | null;
}

export interface AuditDetailState {
  readonly status: AuditLoadStatus;
  readonly data: AuditEvent | null;
  readonly error: ApiError | null;
}
