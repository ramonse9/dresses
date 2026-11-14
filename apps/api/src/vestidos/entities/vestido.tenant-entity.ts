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
  UpdateDateColumn,
} from 'typeorm';
import { Sucursal } from '../../sucursales/entities/sucursal.tenant-entity.js';

export enum VestidoEstadoOperativo {
  DISPONIBLE = 'DISPONIBLE',
  MANTENIMIENTO = 'MANTENIMIENTO',
}

@Entity({ name: 'vestidos' })
@Index('IDX_vestidos_sucursal_id', ['sucursalId'])
@Index('IDX_vestidos_activo', ['activo'])
@Check(
  'CHK_vestidos_estado_operativo',
  `"estado_operativo" IN ('DISPONIBLE', 'MANTENIMIENTO')`,
)
@Check('CHK_vestidos_precio_renta', `"precio_renta" >= 0`)
@Check('CHK_vestidos_deposito', `"deposito" IS NULL OR "deposito" >= 0`)
export class Vestido {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'sucursal_id', type: 'uuid' })
  sucursalId!: string;

  @Column({ length: 50 })
  codigo!: string;

  @Column({ length: 160 })
  nombre!: string;

  @Column({ type: 'varchar', length: 1_000, nullable: true })
  descripcion!: string | null;

  @Column({ length: 30 })
  talla!: string;

  @Column({ length: 80 })
  color!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  marca!: string | null;

  @Column({ name: 'precio_renta', type: 'numeric', precision: 12, scale: 2 })
  precioRenta!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  deposito!: string | null;

  @Column({
    name: 'estado_operativo',
    type: 'varchar',
    length: 20,
    default: VestidoEstadoOperativo.DISPONIBLE,
  })
  estadoOperativo!: VestidoEstadoOperativo;

  @Column({ default: true })
  activo!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => Sucursal, (sucursal) => sucursal.vestidos, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'sucursal_id' })
  sucursal!: Relation<Sucursal>;
}
