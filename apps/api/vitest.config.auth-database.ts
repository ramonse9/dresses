import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: [
      'test/auth-sessions.integration.ts',
      'test/auth-company-selection.integration.ts',
      'test/equipo-miembros.integration.ts',
      'test/equipo-membresias.integration.ts',
      'test/empresa-invitaciones-migration.integration.ts',
      'test/empresa-invitaciones.integration.ts',
      'test/empresa-invitaciones-aceptacion.integration.ts',
      'test/password-reset-tokens-migration.integration.ts',
      'test/password-recovery.integration.ts',
    ],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
