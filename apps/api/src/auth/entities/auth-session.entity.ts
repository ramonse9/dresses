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

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      usuarioId: this.usuarioId,
      expiresAt: this.expiresAt,
      revokedAt: this.revokedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
