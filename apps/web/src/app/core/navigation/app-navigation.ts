import { hasAnyRole } from '../auth/role-access';
import type { EmpresaRole } from '../tenant/tenant.models';

export type AppNavigationIcon =
  | 'dashboard'
  | 'branches'
  | 'customers'
  | 'dresses'
  | 'availability'
  | 'reservations'
  | 'team'
  | 'audit';

export interface AppNavigationItem {
  readonly label: string;
  readonly route: string;
  readonly icon: AppNavigationIcon;
  readonly roles: readonly EmpresaRole[];
}

const consultationRoles = ['OWNER', 'EMPLOYEE'] as const satisfies readonly EmpresaRole[];

export const APP_NAVIGATION: readonly AppNavigationItem[] = [
  { label: 'Dashboard', route: '/app/dashboard', icon: 'dashboard', roles: consultationRoles },
  { label: 'Sucursales', route: '/app/sucursales', icon: 'branches', roles: consultationRoles },
  { label: 'Clientes', route: '/app/clientes', icon: 'customers', roles: consultationRoles },
  { label: 'Vestidos', route: '/app/vestidos', icon: 'dresses', roles: consultationRoles },
  {
    label: 'Disponibilidad',
    route: '/app/disponibilidad',
    icon: 'availability',
    roles: consultationRoles,
  },
  {
    label: 'Reservaciones',
    route: '/app/reservaciones',
    icon: 'reservations',
    roles: consultationRoles,
  },
  { label: 'Equipo', route: '/app/equipo', icon: 'team', roles: ['OWNER'] },
  { label: 'Auditoría', route: '/app/auditoria', icon: 'audit', roles: ['OWNER'] },
];

export function navigationForRole(
  role: EmpresaRole | null,
  items: readonly AppNavigationItem[] = APP_NAVIGATION,
): readonly AppNavigationItem[] {
  return items.filter(({ roles }) => hasAnyRole(role, roles));
}
