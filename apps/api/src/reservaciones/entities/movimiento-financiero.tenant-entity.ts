import {
  BeforeInsert,
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
} from 'typeorm';
import { Sucursal } from '../../sucursales/entities/sucursal.tenant-entity.js';
import { Reservacion } from './reservacion.tenant-entity.js';

export enum MovimientoFinancieroTipo {
  PAGO_RENTA = 'PAGO_RENTA',
  PAGO_DEPOSITO = 'PAGO_DEPOSITO',
  REEMBOLSO_RENTA = 'REEMBOLSO_RENTA',
  DEVOLUCION_DEPOSITO = 'DEVOLUCION_DEPOSITO',
  REVERSO = 'REVERSO',
}

export enum MovimientoFinancieroMetodoPago {
  EFECTIVO = 'EFECTIVO',
  TARJETA = 'TARJETA',
  TRANSFERENCIA = 'TRANSFERENCIA',
  OTRO = 'OTRO',
}

function normalizeOptionalText(
  value: string | null | undefined,
): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
}

@Entity({ name: 'movimientos_financieros' })
@Index('IDX_movimientos_financieros_reservacion_created_at_id', [
  'reservacionId',
  'createdAt',
  'id',
])
@Index('IDX_movimientos_financieros_sucursal_created_at_id', [
  'sucursalId',
  'createdAt',
  'id',
])
@Index('IDX_movimientos_financieros_tipo_created_at', ['tipo', 'createdAt'])
@Index('IDX_movimientos_financieros_origen_id', ['movimientoOrigenId'])
@Index('IDX_movimientos_financieros_registrado_por_created_at', [
  'registradoPorUsuarioId',
  'createdAt',
])
@Index('UQ_movimientos_financieros_idempotency_key', ['idempotencyKey'], {
  unique: true,
})
@Check('CHK_movimientos_financieros_monto_positivo', `"monto" > 0`)
@Check(
  'CHK_movimientos_financieros_tipo',
  `"tipo" IN ('PAGO_RENTA', 'PAGO_DEPOSITO', 'REEMBOLSO_RENTA', 'DEVOLUCION_DEPOSITO', 'REVERSO')`,
)
@Check(
  'CHK_movimientos_financieros_metodo_pago',
  `"metodo_pago" IN ('EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'OTRO')`,
)
@Check(
  'CHK_movimientos_financieros_origen_por_tipo',
  `(("tipo" IN ('PAGO_RENTA', 'PAGO_DEPOSITO') AND "movimiento_origen_id" IS NULL) OR ("tipo" IN ('REEMBOLSO_RENTA', 'DEVOLUCION_DEPOSITO', 'REVERSO') AND "movimiento_origen_id" IS NOT NULL))`,
)
@Check(
  'CHK_movimientos_financieros_referencia_normalized',
  `"referencia" IS NULL OR ("referencia" = BTRIM("referencia") AND LENGTH("referencia") > 0)`,
)
@Check(
  'CHK_movimientos_financieros_notas_normalized',
  `"notas" IS NULL OR ("notas" = BTRIM("notas") AND LENGTH("notas") > 0)`,
)
export class MovimientoFinanciero {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'reservacion_id', type: 'uuid' })
  reservacionId!: string;

  @Column({ name: 'sucursal_id', type: 'uuid' })
  sucursalId!: string;

  @Column({ type: 'varchar', length: 30 })
  tipo!: MovimientoFinancieroTipo;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  monto!: string;

  @Column({ name: 'metodo_pago', type: 'varchar', length: 20 })
  metodoPago!: MovimientoFinancieroMetodoPago;

  @Column({ type: 'varchar', length: 120, nullable: true })
  referencia!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  notas!: string | null;

  @Column({ name: 'movimiento_origen_id', type: 'uuid', nullable: true })
  movimientoOrigenId!: string | null;

  @Column({ name: 'idempotency_key', type: 'uuid' })
  idempotencyKey!: string;

  @Column({ name: 'registrado_por_usuario_id', type: 'uuid' })
  registradoPorUsuarioId!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne(
    () => Reservacion,
    (reservacion) => reservacion.movimientosFinancieros,
    { nullable: false, onDelete: 'RESTRICT' },
  )
  @JoinColumn({ name: 'reservacion_id' })
  reservacion!: Relation<Reservacion>;

  @ManyToOne(() => Sucursal, (sucursal) => sucursal.movimientosFinancieros, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'sucursal_id' })
  sucursal!: Relation<Sucursal>;

  @ManyToOne(
    () => MovimientoFinanciero,
    (movimiento) => movimiento.movimientosDerivados,
    { nullable: true, onDelete: 'RESTRICT' },
  )
  @JoinColumn({ name: 'movimiento_origen_id' })
  movimientoOrigen!: Relation<MovimientoFinanciero> | null;

  @OneToMany(
    () => MovimientoFinanciero,
    (movimiento) => movimiento.movimientoOrigen,
  )
  movimientosDerivados!: Relation<MovimientoFinanciero[]>;

  @BeforeInsert()
  normalize(): void {
    this.referencia = normalizeOptionalText(this.referencia);
    this.notas = normalizeOptionalText(this.notas);
  }
}
