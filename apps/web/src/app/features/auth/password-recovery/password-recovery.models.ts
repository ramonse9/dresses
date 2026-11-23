export interface RequestPasswordRecoveryInput {
  readonly email: string;
}

export interface ResetPasswordInput {
  readonly token: string;
  readonly password: string;
}

export interface PasswordRecoveryResponse {
  readonly message: string;
}
