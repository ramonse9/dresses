import {
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
import { Usuario } from '../../usuarios/entities/usuario.entity.js';

@Entity({ name: 'auth_sessions', schema: 'public' })
@Index('UQ_auth_sessions_refresh_token_hash', ['refreshTokenHash'], {
  unique: true,
})
@Index('IDX_auth_sessions_usuario', ['usuarioId'])
@Index('IDX_auth_sessions_expires_at', ['expiresAt'])
@Index('IDX_auth_sessions_usuario_revoked_at', ['usuarioId', 'revokedAt'])
@Index('IDX_auth_sessions_usuario_last_seen_at', ['usuarioId', 'lastSeenAt'])
export class AuthSession {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_auth_sessions',
  })
  id!: string;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId!: string;

  @Column({
    name: 'refresh_token_hash',
    type: 'varchar',
    length: 64,
    select: false,
  })
  refreshTokenHash!: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @Column({ name: 'ip_address', type: 'inet', nullable: true })
  ipAddress!: string | null;

  @Column({ name: 'user_agent', type: 'varchar', length: 512, nullable: true })
  userAgent!: string | null;

  @Column({
    name: 'last_seen_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  lastSeenAt!: Date;

  @Column({ name: 'revoked_by_usuario_id', type: 'uuid', nullable: true })
  revokedByUsuarioId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => Usuario, (usuario) => usuario.authSessions, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'usuario_id',
    foreignKeyConstraintName: 'FK_auth_sessions_usuario',
  })
  usuario!: Relation<Usuario>;

  @ManyToOne(() => Usuario, (usuario) => usuario.authSessionsRevocadas, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({
    name: 'revoked_by_usuario_id',
    foreignKeyConstraintName: 'FK_auth_sessions_revoked_by_usuario',
  })
  revokedByUsuario!: Relation<Usuario> | null;

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      usuarioId: this.usuarioId,
      expiresAt: this.expiresAt,
      revokedAt: this.revokedAt,
      ipAddress: this.ipAddress,
      userAgent: this.userAgent,
      lastSeenAt: this.lastSeenAt,
      revokedByUsuarioId: this.revokedByUsuarioId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
