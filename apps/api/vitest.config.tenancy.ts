import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: [
      'test/tenant-isolation.integration.ts',
      'test/clientes-migration.integration.ts',
      'test/clientes-crud.integration.ts',
      'test/reservaciones-migration.integration.ts',
      'test/movimientos-financieros-migration.integration.ts',
      'test/reservaciones-finanzas.integration.ts',
      'test/reservaciones-create.integration.ts',
      'test/reservaciones-lifecycle.integration.ts',
      'test/reservaciones-query-update.integration.ts',
      'test/vestidos-create.integration.ts',
      'test/vestidos-disponibilidad.integration.ts',
      'test/vestidos-migration.integration.ts',
      'test/tenant-resource-audit.integration.ts',
      'test/reservation-audit.integration.ts',
    ],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
