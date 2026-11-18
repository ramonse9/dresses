import type { ApiError } from '../http/api-error';

export const AUTH_INITIALIZATION_STATES = ['initializing', 'authenticated', 'anonymous'] as const;

export type AuthInitializationState = (typeof AUTH_INITIALIZATION_STATES)[number];

export interface LoginCredentials {
  readonly email: string;
  readonly password: string;
}

export interface AccessTokenResponse {
  readonly accessToken: string;
  readonly tokenType: 'Bearer';
  readonly expiresIn: number;
}

export interface AuthenticatedUser {
  readonly sub: string;
  readonly email: string;
  readonly sessionId: string;
}

export interface AuthSessionState {
  readonly status: AuthInitializationState;
  readonly user: AuthenticatedUser | null;
  readonly accessTokenExpiresAt: number | null;
  readonly initializationError: ApiError | null;
}
