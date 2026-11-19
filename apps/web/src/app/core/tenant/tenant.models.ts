export const EMPRESA_ROLES = ['OWNER', 'EMPLOYEE'] as const;

export type EmpresaRole = (typeof EMPRESA_ROLES)[number];

export interface AvailableCompany {
  readonly id: string;
  readonly nombre: string;
  readonly slug: string;
  readonly rol: EmpresaRole;
}

export interface SelectedTenantSession {
  readonly empresa: AvailableCompany;
  readonly empresaId: string;
  readonly rol: EmpresaRole;
}

export const TENANT_LOAD_STATES = [
  'idle',
  'loading',
  'ready',
  'selecting',
  'empty',
  'error',
] as const;

export type TenantLoadState = (typeof TENANT_LOAD_STATES)[number];
