import { hasAnyRole } from './role-access';

describe('hasAnyRole', () => {
  it('allows a current role included in the policy', () => {
    expect(hasAnyRole('OWNER', ['OWNER'])).toBe(true);
    expect(hasAnyRole('EMPLOYEE', ['OWNER', 'EMPLOYEE'])).toBe(true);
  });

  it('rejects a missing or excluded role', () => {
    expect(hasAnyRole('EMPLOYEE', ['OWNER'])).toBe(false);
    expect(hasAnyRole(null, ['OWNER', 'EMPLOYEE'])).toBe(false);
  });
});
