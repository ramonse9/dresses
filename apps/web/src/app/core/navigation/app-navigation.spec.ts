import type { AppNavigationItem } from './app-navigation';
import { APP_NAVIGATION, navigationForRole } from './app-navigation';

describe('application navigation', () => {
  it('shows the complete navigation to OWNER', () => {
    expect(navigationForRole('OWNER')).toEqual(APP_NAVIGATION);
    expect(navigationForRole('OWNER').map(({ label }) => label)).toContain('Equipo');
  });

  it('hides team administration from EMPLOYEE', () => {
    expect(navigationForRole('EMPLOYEE').map(({ label }) => label)).not.toContain('Equipo');
    expect(navigationForRole('EMPLOYEE')).toHaveLength(APP_NAVIGATION.length - 1);
  });

  it('supports role-specific entries without relying on the template', () => {
    const items: AppNavigationItem[] = [
      { label: 'Consulta', route: '/consulta', icon: 'dashboard', roles: ['OWNER', 'EMPLOYEE'] },
      { label: 'Administración', route: '/admin', icon: 'branches', roles: ['OWNER'] },
    ];

    expect(navigationForRole('EMPLOYEE', items).map(({ label }) => label)).toEqual(['Consulta']);
    expect(navigationForRole('OWNER', items).map(({ label }) => label)).toEqual([
      'Consulta',
      'Administración',
    ]);
  });

  it('returns no entries without a verified role', () => {
    expect(navigationForRole(null)).toEqual([]);
  });
});
