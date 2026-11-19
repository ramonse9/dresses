import type { EmpresaRole } from '../tenant/tenant.models';

export function hasAnyRole(
  currentRole: EmpresaRole | null,
  allowedRoles: readonly EmpresaRole[],
): boolean {
  return currentRole !== null && allowedRoles.includes(currentRole);
}
