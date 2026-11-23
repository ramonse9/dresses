export type AccountSession = {
  readonly id: string;
  readonly current: boolean;
  readonly createdAt: string;
  readonly lastSeenAt: string;
  readonly expiresAt: string;
  readonly revokedAt: string | null;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
};

export type RevokeOtherSessionsResponse = {
  readonly revokedCount: number;
};

export type SessionConfirmation =
  { readonly kind: 'session'; readonly session: AccountSession } | { readonly kind: 'others' };
