import {
  isTenantSchemaName,
  tenantSchemaNameFromEmpresaId,
} from './tenant-schema-name.js';

describe('tenant schema name convention', () => {
  it('derives a safe identifier from an Empresa UUID', () => {
    const schemaName = tenantSchemaNameFromEmpresaId(
      '019a6f33-82b7-7a22-971b-6a8d7c5e4f30',
    );

    expect(schemaName).toBe('tenant_019a6f3382b77a22971b6a8d7c5e4f30');
    expect(isTenantSchemaName(schemaName)).toBe(true);
  });

  it.each([
    'boutique-centro',
    'tenant_public',
    'tenant_a;drop schema public',
    'tenant_019A6F3382B77A22971B6A8D7C5E4F30',
  ])('rejects unsafe schema name %s', (schemaName) => {
    expect(isTenantSchemaName(schemaName)).toBe(false);
  });

  it('rejects values that are not UUIDs', () => {
    expect(() => tenantSchemaNameFromEmpresaId('public')).toThrow(
      'A valid Empresa UUID is required',
    );
  });
});
