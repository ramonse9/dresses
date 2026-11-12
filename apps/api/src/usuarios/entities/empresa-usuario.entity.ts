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
import { Empresa } from '../../empresas/entities/empresa.entity.js';
import { Usuario } from './usuario.entity.js';

export enum EmpresaUsuarioRol {
  OWNER = 'OWNER',
  EMPLOYEE = 'EMPLOYEE',
}

@Entity({ name: 'empresa_usuarios', schema: 'public' })
@Index('UQ_empresa_usuarios_usuario_empresa', ['usuarioId', 'empresaId'], {
  unique: true,
})
@Index('IDX_empresa_usuarios_usuario', ['usuarioId'])
@Index('IDX_empresa_usuarios_empresa', ['empresaId'])
@Check('CHK_empresa_usuarios_rol', `"rol" IN ('OWNER', 'EMPLOYEE')`)
export class EmpresaUsuario {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId!: string;

  @Column({ name: 'empresa_id', type: 'uuid' })
  empresaId!: string;

  @Column({ type: 'varchar', length: 20 })
  rol!: EmpresaUsuarioRol;

  @Column({ default: true })
  activo!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne(() => Usuario, (usuario) => usuario.membresias, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'usuario_id' })
  usuario!: Relation<Usuario>;

  @ManyToOne(() => Empresa, (empresa) => empresa.membresias, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'empresa_id' })
  empresa!: Relation<Empresa>;
}
