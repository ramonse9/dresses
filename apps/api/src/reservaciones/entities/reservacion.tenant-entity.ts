import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  type Relation,
  UpdateDateColumn,
} from 'typeorm';
import { Cliente } from '../../clientes/entities/cliente.tenant-entity.js';
import { Sucursal } from '../../sucursales/entities/sucursal.tenant-entity.js';
import { ReservacionVestido } from './reservacion-vestido.tenant-entity.js';

export enum ReservacionEstado {
  BORRADOR = 'BORRADOR',
  CONFIRMADA = 'CONFIRMADA',
  ENTREGADA = 'ENTREGADA',
  DEVUELTA = 'DEVUELTA',
  CANCELADA = 'CANCELADA',
}

@Entity({ name: 'reservaciones' })
@Index('IDX_reservaciones_cliente_created_at', ['clienteId', 'createdAt'])
@Index('IDX_reservaciones_sucursal_estado_fechas', [
  'sucursalId',
  'estado',
  'fechaInicio',
  'fechaFin',
])
@Index('IDX_reservaciones_estado_fechas', ['estado', 'fechaInicio', 'fechaFin'])
@Check('CHK_reservaciones_fechas', `"fecha_fin" > "fecha_inicio"`)
@Check(
  'CHK_reservaciones_estado',
  `"estado" IN ('BORRADOR', 'CONFIRMADA', 'ENTREGADA', 'DEVUELTA', 'CANCELADA')`,
)
@Check('CHK_reservaciones_importe_renta', `"importe_renta" >= 0`)
@Check('CHK_reservaciones_deposito_requerido', `"deposito_requerido" >= 0`)
export class Reservacion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'cliente_id', type: 'uuid' })
  clienteId!: string;

  @Column({ name: 'sucursal_id', type: 'uuid' })
  sucursalId!: string;

  @Column({ name: 'fecha_inicio', type: 'timestamptz' })
  fechaInicio!: Date;

  @Column({ name: 'fecha_fin', type: 'timestamptz' })
  fechaFin!: Date;

  @Column({
    type: 'varchar',
    length: 20,
    default: ReservacionEstado.BORRADOR,
  })
  estado!: ReservacionEstado;

  @Column({ type: 'varchar', length: 2_000, nullable: true })
  notas!: string | null;

  @Column({
    name: 'importe_renta',
    type: 'numeric',
    precision: 12,
    scale: 2,
  })
  importeRenta!: string;

  @Column({
    name: 'deposito_requerido',
    type: 'numeric',
    precision: 12,
    scale: 2,
  })
  depositoRequerido!: string;

  @Column({ name: 'confirmada_at', type: 'timestamptz', nullable: true })
  confirmadaAt!: Date | null;

  @Column({ name: 'entregada_at', type: 'timestamptz', nullable: true })
  entregadaAt!: Date | null;

  @Column({ name: 'devuelta_at', type: 'timestamptz', nullable: true })
  devueltaAt!: Date | null;

  @Column({ name: 'cancelada_at', type: 'timestamptz', nullable: true })
  canceladaAt!: Date | null;

  @Column({
    name: 'motivo_cancelacion',
    type: 'varchar',
    length: 1_000,
    nullable: true,
  })
  motivoCancelacion!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => Cliente, (cliente) => cliente.reservaciones, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'cliente_id' })
  cliente!: Relation<Cliente>;

  @ManyToOne(() => Sucursal, (sucursal) => sucursal.reservaciones, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'sucursal_id' })
  sucursal!: Relation<Sucursal>;

  @OneToMany(
    () => ReservacionVestido,
    (reservacionVestido) => reservacionVestido.reservacion,
  )
  vestidos!: Relation<ReservacionVestido[]>;
}
