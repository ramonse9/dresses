import type { AppNavigationItem } from './app-navigation';
import { APP_NAVIGATION, navigationForRole } from './app-navigation';

describe('application navigation', () => {
  it.each(['OWNER', 'EMPLOYEE'] as const)('allows all consultation routes to %s', (role) => {
    expect(navigationForRole(role)).toEqual(APP_NAVIGATION);
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
