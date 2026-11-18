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
  Unique,
} from 'typeorm';
import { Vestido } from '../../vestidos/entities/vestido.tenant-entity.js';
import { Reservacion } from './reservacion.tenant-entity.js';

@Entity({ name: 'reservacion_vestidos' })
@Unique('UQ_reservacion_vestidos_reservacion_vestido', [
  'reservacionId',
  'vestidoId',
])
@Index('IDX_reservacion_vestidos_reservacion_id', ['reservacionId'])
@Index('IDX_reservacion_vestidos_vestido_id', ['vestidoId', 'reservacionId'])
@Check('CHK_reservacion_vestidos_precio_renta', `"precio_renta" >= 0`)
@Check('CHK_reservacion_vestidos_deposito', `"deposito" >= 0`)
export class ReservacionVestido {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'reservacion_id', type: 'uuid' })
  reservacionId!: string;

  @Column({ name: 'vestido_id', type: 'uuid' })
  vestidoId!: string;

  @Column({
    name: 'precio_renta',
    type: 'numeric',
    precision: 12,
    scale: 2,
  })
  precioRenta!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  deposito!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne(() => Reservacion, (reservacion) => reservacion.vestidos, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'reservacion_id' })
  reservacion!: Relation<Reservacion>;

  @ManyToOne(() => Vestido, (vestido) => vestido.reservacionVestidos, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'vestido_id' })
  vestido!: Relation<Vestido>;
}
