import {
  BeforeInsert,
  BeforeUpdate,
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { normalizeEmail } from '../email.js';
import { EmpresaUsuario } from './empresa-usuario.entity.js';

@Entity({ name: 'usuarios', schema: 'public' })
@Index('UQ_usuarios_email', ['email'], { unique: true })
@Check('CHK_usuarios_email_lowercase', `"email" = LOWER("email")`)
export class Usuario {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 254 })
  email!: string;

  @Column({ name: 'password_hash', length: 255, select: false })
  passwordHash!: string;

  @Column({ length: 160 })
  nombre!: string;

  @Column({ default: true })
  activo!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => EmpresaUsuario, (membresia) => membresia.usuario)
  membresias!: EmpresaUsuario[];

  @BeforeInsert()
  @BeforeUpdate()
  normalizeEmail(): void {
    this.email = normalizeEmail(this.email);
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      email: this.email,
      nombre: this.nombre,
      activo: this.activo,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
