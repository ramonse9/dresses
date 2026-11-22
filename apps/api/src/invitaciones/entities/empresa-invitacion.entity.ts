import {
  BeforeInsert,
  BeforeUpdate,
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
  UpdateDateColumn,
} from 'typeorm';
import { Empresa } from '../../empresas/entities/empresa.entity.js';
import { normalizeEmail } from '../../usuarios/email.js';
import { EmpresaUsuarioRol } from '../../usuarios/entities/empresa-usuario.entity.js';
import { Usuario } from '../../usuarios/entities/usuario.entity.js';

export enum EmpresaInvitacionEstado {
  PENDIENTE = 'PENDIENTE',
  ACEPTADA = 'ACEPTADA',
  REVOCADA = 'REVOCADA',
  EXPIRADA = 'EXPIRADA',
}

@Entity({ name: 'empresa_invitaciones', schema: 'public' })
@Index('IDX_empresa_invitaciones_empresa_created_at', [
  'empresaId',
  'createdAt',
])
@Index('IDX_empresa_invitaciones_empresa_email', ['empresaId', 'email'])
@Index('IDX_empresa_invitaciones_expires_at', ['expiresAt'])
@Index('UQ_empresa_invitaciones_token_hash', ['tokenHash'], { unique: true })
@Index(
  'UQ_empresa_invitaciones_pendiente_empresa_email',
  ['empresaId', 'email'],
  {
    unique: true,
    where: '"accepted_at" IS NULL AND "revoked_at" IS NULL',
  },
)
@Index('IDX_empresa_invitaciones_pendientes', ['empresaId', 'expiresAt'], {
  where: '"accepted_at" IS NULL AND "revoked_at" IS NULL',
})
@Check(
  'CHK_empresa_invitaciones_email_normalized',
  '"email" = LOWER(BTRIM("email")) AND "email" <> \'\'',
)
@Check('CHK_empresa_invitaciones_rol', `"rol" IN ('OWNER', 'EMPLOYEE')`)
@Check('CHK_empresa_invitaciones_token_hash', `"token_hash" ~ '^[0-9a-f]{64}$'`)
@Check('CHK_empresa_invitaciones_send_count', '"send_count" >= 0')
export class EmpresaInvitacion {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_empresa_invitaciones',
  })
  id!: string;

  @Column({ name: 'empresa_id', type: 'uuid' })
  empresaId!: string;

  @Column({ type: 'varchar', length: 254 })
  email!: string;

  @Column({ type: 'varchar', length: 20 })
  rol!: EmpresaUsuarioRol;

  @Column({ name: 'token_hash', type: 'varchar', length: 64, select: false })
  tokenHash!: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt!: Date | null;

  @Column({ name: 'accepted_by_usuario_id', type: 'uuid', nullable: true })
  acceptedByUsuarioId!: string | null;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @Column({ name: 'created_by_usuario_id', type: 'uuid' })
  createdByUsuarioId!: string;

  @Column({ name: 'last_sent_at', type: 'timestamptz', nullable: true })
  lastSentAt!: Date | null;

  @Column({ name: 'send_count', type: 'integer', default: 0 })
  sendCount!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => Empresa, (empresa) => empresa.invitaciones, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'empresa_id',
    foreignKeyConstraintName: 'FK_empresa_invitaciones_empresa',
  })
  empresa!: Relation<Empresa>;

  @ManyToOne(() => Usuario, (usuario) => usuario.invitacionesCreadas, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'created_by_usuario_id',
    foreignKeyConstraintName: 'FK_empresa_invitaciones_created_by_usuario',
  })
  createdByUsuario!: Relation<Usuario>;

  @ManyToOne(() => Usuario, (usuario) => usuario.invitacionesAceptadas, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'accepted_by_usuario_id',
    foreignKeyConstraintName: 'FK_empresa_invitaciones_accepted_by_usuario',
  })
  acceptedByUsuario!: Relation<Usuario> | null;

  @BeforeInsert()
  @BeforeUpdate()
  normalizeEmail(): void {
    this.email = normalizeEmail(this.email);
  }

  getEstado(now: Date = new Date()): EmpresaInvitacionEstado {
    if (this.acceptedAt !== null) {
      return EmpresaInvitacionEstado.ACEPTADA;
    }
    if (this.revokedAt !== null) {
      return EmpresaInvitacionEstado.REVOCADA;
    }
    if (this.expiresAt.getTime() <= now.getTime()) {
      return EmpresaInvitacionEstado.EXPIRADA;
    }
    return EmpresaInvitacionEstado.PENDIENTE;
  }

  isUsable(empresaActiva: boolean, now: Date = new Date()): boolean {
    return (
      empresaActiva && this.getEstado(now) === EmpresaInvitacionEstado.PENDIENTE
    );
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      empresaId: this.empresaId,
      email: this.email,
      rol: this.rol,
      expiresAt: this.expiresAt,
      acceptedAt: this.acceptedAt,
      acceptedByUsuarioId: this.acceptedByUsuarioId,
      revokedAt: this.revokedAt,
      createdByUsuarioId: this.createdByUsuarioId,
      lastSentAt: this.lastSentAt,
      sendCount: this.sendCount,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
