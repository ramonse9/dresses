import type { ApiError } from '../../core/http/api-error';

export interface Branch {
  readonly id: string;
  readonly nombre: string;
  readonly direccion: string | null;
  readonly telefono: string | null;
  readonly activo: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateBranchInput {
  readonly nombre: string;
  readonly direccion: string | null;
  readonly telefono: string | null;
}

export type UpdateBranchInput = CreateBranchInput;

export const BRANCH_LOAD_STATES = ['idle', 'loading', 'loaded', 'empty', 'error'] as const;

export type BranchLoadState = (typeof BRANCH_LOAD_STATES)[number];

export interface BranchResourceState<T> {
  readonly status: BranchLoadState;
  readonly data: T;
  readonly error: ApiError | null;
}
