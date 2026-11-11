const EMPRESA_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const TENANT_SCHEMA_NAME_PATTERN = /^tenant_[0-9a-f]{32}$/;

/**
 * Tenant schemas are derived only from a server-generated Empresa UUID.
 * Slugs and client-provided schema names must never be used as identifiers.
 */
export function tenantSchemaNameFromEmpresaId(empresaId: string): string {
  if (!EMPRESA_ID_PATTERN.test(empresaId)) {
    throw new Error('A valid Empresa UUID is required');
  }

  return `tenant_${empresaId.replaceAll('-', '').toLowerCase()}`;
}

export function isTenantSchemaName(value: string): boolean {
  return TENANT_SCHEMA_NAME_PATTERN.test(value);
}

export function quoteTenantSchemaName(value: string): string {
  if (!isTenantSchemaName(value)) {
    throw new Error('Invalid tenant schema name');
  }

  return `"${value}"`;
}
