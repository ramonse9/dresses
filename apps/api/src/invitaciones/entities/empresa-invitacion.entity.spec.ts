import { getMetadataArgsStorage } from 'typeorm';
import { Empresa } from '../../empresas/entities/empresa.entity.js';
import { EmpresaUsuarioRol } from '../../usuarios/entities/empresa-usuario.entity.js';
import { Usuario } from '../../usuarios/entities/usuario.entity.js';
import {
  EmpresaInvitacion,
  EmpresaInvitacionEstado,
} from './empresa-invitacion.entity.js';

describe('EmpresaInvitacion', () => {
  it('defines the invitation only in public with the expected columns', () => {
    const metadata = getMetadataArgsStorage();
    const table = metadata.tables.find(
      (entry) => entry.target === EmpresaInvitacion,
    );
    const columns = metadata.columns.filter(
      (column) => column.target === EmpresaInvitacion,
    );
    const byName = (propertyName: string) =>
      columns.find((column) => column.propertyName === propertyName)?.options;

    expect(table).toMatchObject({
      name: 'empresa_invitaciones',
      schema: 'public',
    });
    expect(byName('email')).toMatchObject({ type: 'varchar', length: 254 });
    expect(byName('rol')).toMatchObject({ type: 'varchar', length: 20 });
    expect(byName('tokenHash')).toMatchObject({
      name: 'token_hash',
      type: 'varchar',
      length: 64,
      select: false,
    });
    expect(byName('expiresAt')).toMatchObject({ type: 'timestamptz' });
    expect(byName('acceptedAt')).toMatchObject({ nullable: true });
    expect(byName('acceptedByUsuarioId')).toMatchObject({ nullable: true });
    expect(byName('revokedAt')).toMatchObject({ nullable: true });
    expect(byName('lastSentAt')).toMatchObject({ nullable: true });
    expect(byName('sendCount')).toMatchObject({ type: 'integer', default: 0 });
  });

  it('normalizes email and defines only OWNER and EMPLOYEE roles', () => {
    const invitation = Object.assign(new EmpresaInvitacion(), {
      email: '  Invited.User@Example.COM  ',
    });

    invitation.normalizeEmail();

    expect(invitation.email).toBe('invited.user@example.com');
    expect(Object.values(EmpresaUsuarioRol)).toEqual(['OWNER', 'EMPLOYEE']);
  });

  it('declares global relations and inverse relations with restricted deletion', () => {
    const relations = getMetadataArgsStorage().relations;
    const relation = (target: object, propertyName: string) =>
      relations.find(
        (entry) =>
          entry.target === target && entry.propertyName === propertyName,
      );

    expect(relation(EmpresaInvitacion, 'empresa')).toMatchObject({
      relationType: 'many-to-one',
      options: { nullable: false, onDelete: 'RESTRICT' },
    });
    expect(relation(EmpresaInvitacion, 'createdByUsuario')).toMatchObject({
      relationType: 'many-to-one',
      options: { nullable: false, onDelete: 'RESTRICT' },
    });
    expect(relation(EmpresaInvitacion, 'acceptedByUsuario')).toMatchObject({
      relationType: 'many-to-one',
      options: { nullable: true, onDelete: 'RESTRICT' },
    });
    expect(relation(Empresa, 'invitaciones')?.relationType).toBe('one-to-many');
    expect(relation(Usuario, 'invitacionesCreadas')?.relationType).toBe(
      'one-to-many',
    );
    expect(relation(Usuario, 'invitacionesAceptadas')?.relationType).toBe(
      'one-to-many',
    );
  });

  it('declares normalization, role, token and send count constraints', () => {
    const checks = getMetadataArgsStorage().checks.filter(
      (check) => check.target === EmpresaInvitacion,
    );

    expect(checks.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        'CHK_empresa_invitaciones_email_normalized',
        'CHK_empresa_invitaciones_rol',
        'CHK_empresa_invitaciones_token_hash',
        'CHK_empresa_invitaciones_send_count',
      ]),
    );
  });

  it('declares lookup indexes, unique hashes and one pending invitation per email', () => {
    const indexes = getMetadataArgsStorage().indices.filter(
      (index) => index.target === EmpresaInvitacion,
    );

    expect(indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'IDX_empresa_invitaciones_empresa_created_at',
          columns: ['empresaId', 'createdAt'],
        }),
        expect.objectContaining({
          name: 'IDX_empresa_invitaciones_empresa_email',
          columns: ['empresaId', 'email'],
        }),
        expect.objectContaining({
          name: 'IDX_empresa_invitaciones_expires_at',
          columns: ['expiresAt'],
        }),
        expect.objectContaining({
          name: 'UQ_empresa_invitaciones_token_hash',
          columns: ['tokenHash'],
          unique: true,
        }),
        expect.objectContaining({
          name: 'UQ_empresa_invitaciones_pendiente_empresa_email',
          columns: ['empresaId', 'email'],
          unique: true,
          where: '"accepted_at" IS NULL AND "revoked_at" IS NULL',
        }),
        expect.objectContaining({
          name: 'IDX_empresa_invitaciones_pendientes',
          columns: ['empresaId', 'expiresAt'],
          where: '"accepted_at" IS NULL AND "revoked_at" IS NULL',
        }),
      ]),
    );
  });

  it('derives pending, accepted, revoked and expired states without persisting one', () => {
    const now = new Date('2026-12-01T12:00:00.000Z');
    const invitation = Object.assign(new EmpresaInvitacion(), {
      acceptedAt: null,
      revokedAt: null,
      expiresAt: new Date('2026-12-02T12:00:00.000Z'),
    });

    expect(invitation.getEstado(now)).toBe(EmpresaInvitacionEstado.PENDIENTE);
    expect(invitation.isUsable(true, now)).toBe(true);
    expect(invitation.isUsable(false, now)).toBe(false);

    invitation.revokedAt = new Date('2026-12-01T13:00:00.000Z');
    expect(invitation.getEstado(now)).toBe(EmpresaInvitacionEstado.REVOCADA);
    invitation.revokedAt = null;
    invitation.acceptedAt = new Date('2026-12-01T13:00:00.000Z');
    expect(invitation.getEstado(now)).toBe(EmpresaInvitacionEstado.ACEPTADA);
    invitation.acceptedAt = null;
    invitation.expiresAt = now;
    expect(invitation.getEstado(now)).toBe(EmpresaInvitacionEstado.EXPIRADA);
  });

  it('never serializes token hashes, relations or schema information', () => {
    const invitation = Object.assign(new EmpresaInvitacion(), {
      id: 'b18c2a56-d33f-4d88-a8e7-42931121e295',
      empresaId: 'a18c2a56-d33f-4d88-a8e7-42931121e295',
      email: 'invited@example.com',
      rol: EmpresaUsuarioRol.EMPLOYEE,
      tokenHash: 'a'.repeat(64),
      expiresAt: new Date('2026-12-02T12:00:00.000Z'),
      acceptedAt: null,
      acceptedByUsuarioId: null,
      revokedAt: null,
      createdByUsuarioId: '019a6f33-82b7-7a22-971b-6a8d7c5e4f30',
      lastSentAt: null,
      sendCount: 0,
      createdAt: new Date('2026-12-01T12:00:00.000Z'),
      updatedAt: new Date('2026-12-01T12:00:00.000Z'),
      empresa: { schemaName: 'tenant_should_not_appear' },
    });

    const serialized = JSON.parse(JSON.stringify(invitation)) as Record<
      string,
      unknown
    >;

    expect(serialized).not.toHaveProperty('tokenHash');
    expect(serialized).not.toHaveProperty('empresa');
    expect(JSON.stringify(serialized)).not.toContain(invitation.tokenHash);
    expect(JSON.stringify(serialized)).not.toContain('schemaName');
    expect(JSON.stringify(serialized)).not.toContain('tenant_');
  });
});
