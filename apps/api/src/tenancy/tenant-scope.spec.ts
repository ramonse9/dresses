import { Empresa } from '../empresas/entities/empresa.entity.js';
import { createTenantScope } from './tenant-scope.js';

describe('TenantScope', () => {
  it('binds an Empresa UUID to its internally derived schema', () => {
    const scope = createTenantScope({
      id: '019a6f33-82b7-7a22-971b-6a8d7c5e4f30',
      slug: 'atelier-norte',
      schemaName: 'tenant_019a6f3382b77a22971b6a8d7c5e4f30',
    } as Empresa);

    expect(scope).toEqual({
      empresaId: '019a6f33-82b7-7a22-971b-6a8d7c5e4f30',
      empresaSlug: 'atelier-norte',
      schemaName: 'tenant_019a6f3382b77a22971b6a8d7c5e4f30',
    });
    expect(Object.isFrozen(scope)).toBe(true);
  });

  it('rejects an Empresa that points to another safe-looking schema', () => {
    expect(() =>
      createTenantScope({
        id: '019a6f33-82b7-7a22-971b-6a8d7c5e4f30',
        slug: 'atelier-norte',
        schemaName: 'tenant_119a6f3382b77a22971b6a8d7c5e4f30',
      } as Empresa),
    ).toThrow('Tenant schema does not match Empresa id');
  });
});
