import type { EmpresaRole } from '../../../core/tenant/tenant.models';

export interface VerifiedInvitation {
  readonly empresaNombre: string;
  readonly email: string;
  readonly rol: EmpresaRole;
  readonly expiresAt: string;
  readonly accountExists: boolean;
}

export interface AcceptInvitationInput {
  readonly token: string;
  readonly password: string;
  readonly nombre?: string;
}

export interface AcceptedInvitationResponse {
  readonly accepted: true;
  readonly message: string;
}

export type InvitationAcceptanceStatus = 'verifying' | 'ready' | 'invalid' | 'accepted';
