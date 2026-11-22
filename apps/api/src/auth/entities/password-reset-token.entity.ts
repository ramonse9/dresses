import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Usuario } from '../../usuarios/entities/usuario.entity.js';

export enum PasswordResetTokenEstado {
  PENDIENTE = 'PENDIENTE',
  USADO = 'USADO',
  REVOCADO = 'REVOCADO',
  EXPIRADO = 'EXPIRADO',
}

@Entity({ name: 'password_reset_tokens', schema: 'public' })
@Index('IDX_password_reset_tokens_usuario_created_at', [
  'usuarioId',
  'createdAt',
])
@Index('IDX_password_reset_tokens_expires_at', ['expiresAt'])
@Index('UQ_password_reset_tokens_token_hash', ['tokenHash'], { unique: true })
@Index('UQ_password_reset_tokens_pending_usuario', ['usuarioId'], {
  unique: true,
  where: '"used_at" IS NULL AND "revoked_at" IS NULL',
})
@Index('IDX_password_reset_tokens_pending', ['usuarioId', 'expiresAt'], {
  where: '"used_at" IS NULL AND "revoked_at" IS NULL',
})
@Check(
  'CHK_password_reset_tokens_token_hash',
  `"token_hash" ~ '^[0-9a-f]{64}$'`,
)
export class PasswordResetToken {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_password_reset_tokens',
  })
  id!: string;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId!: string;

  @Column({ name: 'token_hash', type: 'varchar', length: 64, select: false })
  tokenHash!: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt!: Date | null;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne(() => Usuario, (usuario) => usuario.passwordResetTokens, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'usuario_id',
    foreignKeyConstraintName: 'FK_password_reset_tokens_usuario',
  })
  usuario!: Relation<Usuario>;

  getEstado(now: Date = new Date()): PasswordResetTokenEstado {
    if (this.usedAt !== null) {
      return PasswordResetTokenEstado.USADO;
    }
    if (this.revokedAt !== null) {
      return PasswordResetTokenEstado.REVOCADO;
    }
    if (this.expiresAt.getTime() <= now.getTime()) {
      return PasswordResetTokenEstado.EXPIRADO;
    }
    return PasswordResetTokenEstado.PENDIENTE;
  }

  isUsable(usuarioActivo: boolean, now: Date = new Date()): boolean {
    return (
      usuarioActivo &&
      this.getEstado(now) === PasswordResetTokenEstado.PENDIENTE
    );
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      usuarioId: this.usuarioId,
      expiresAt: this.expiresAt,
      usedAt: this.usedAt,
      revokedAt: this.revokedAt,
      createdAt: this.createdAt,
    };
  }
}
