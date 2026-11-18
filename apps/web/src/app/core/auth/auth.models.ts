export type AuthStatus = 'checking' | 'anonymous' | 'authenticated';

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
  readonly empresaId?: string;
  readonly rol?: 'OWNER' | 'EMPLOYEE';
}
