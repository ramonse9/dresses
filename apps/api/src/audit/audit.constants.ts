export const AUDIT_ACTIONS = {
  AUTH_LOGIN_SUCCEEDED: 'auth.login.succeeded',
  AUTH_LOGOUT: 'auth.logout',
  MEMBERSHIP_ROLE_CHANGED: 'membership.role.changed',
  MEMBERSHIP_ACTIVATED: 'membership.activated',
  MEMBERSHIP_DEACTIVATED: 'membership.deactivated',
  INVITATION_CREATED: 'invitation.created',
  INVITATION_RESENT: 'invitation.resent',
  INVITATION_REVOKED: 'invitation.revoked',
  INVITATION_ACCEPTED: 'invitation.accepted',
  PASSWORD_RESET_COMPLETED: 'password.reset.completed',
  SESSION_REVOKED: 'session.revoked',
  OTHER_SESSIONS_REVOKED: 'session.others.revoked',
  TENANT_RESOURCE_CREATED: 'tenant.resource.created',
  TENANT_RESOURCE_UPDATED: 'tenant.resource.updated',
  TENANT_RESOURCE_DEACTIVATED: 'tenant.resource.deactivated',
  TENANT_RESOURCE_STATE_CHANGED: 'tenant.resource.state.changed',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export const AUDIT_RESOURCE_TYPES = {
  AUTH_SESSION: 'auth_session',
  USER: 'usuario',
  MEMBERSHIP: 'empresa_usuario',
  INVITATION: 'empresa_invitacion',
  BRANCH: 'sucursal',
  CUSTOMER: 'cliente',
  DRESS: 'vestido',
  RESERVATION: 'reservacion',
} as const;

export type AuditResourceType =
  (typeof AUDIT_RESOURCE_TYPES)[keyof typeof AUDIT_RESOURCE_TYPES];
