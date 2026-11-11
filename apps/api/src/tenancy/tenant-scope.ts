import { Empresa } from '../empresas/entities/empresa.entity.js';
import { tenantSchemaNameFromEmpresaId } from '../empresas/tenant-schema-name.js';

declare const tenantSchemaBrand: unique symbol;

export type TenantSchemaName = string & {
  readonly [tenantSchemaBrand]: true;
};

export type TenantScope = Readonly<{
  empresaId: string;
  empresaSlug: string;
  schemaName: TenantSchemaName;
}>;

export function createTenantScope(empresa: Empresa): TenantScope {
  const expectedSchemaName = tenantSchemaNameFromEmpresaId(empresa.id);

  if (empresa.schemaName !== expectedSchemaName) {
    throw new Error('Tenant schema does not match Empresa id');
  }

  return Object.freeze({
    empresaId: empresa.id,
    empresaSlug: empresa.slug,
    schemaName: expectedSchemaName as TenantSchemaName,
  });
}

export function assertTenantScope(scope: TenantScope): void {
  const expectedSchemaName = tenantSchemaNameFromEmpresaId(scope.empresaId);

  if (scope.schemaName !== expectedSchemaName) {
    throw new Error('Invalid tenant scope');
  }
}
