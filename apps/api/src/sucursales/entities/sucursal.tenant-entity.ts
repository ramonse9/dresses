import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  type Relation,
  UpdateDateColumn,
} from 'typeorm';
import { Reservacion } from '../../reservaciones/entities/reservacion.tenant-entity.js';
import { MovimientoFinanciero } from '../../reservaciones/entities/movimiento-financiero.tenant-entity.js';
import { Vestido } from '../../vestidos/entities/vestido.tenant-entity.js';

@Entity({ name: 'sucursales' })
export class Sucursal {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 160 })
  nombre!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  direccion!: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  telefono!: string | null;

  @Column({ default: true })
  activo!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => Vestido, (vestido) => vestido.sucursal)
  vestidos!: Relation<Vestido[]>;

  @OneToMany(() => Reservacion, (reservacion) => reservacion.sucursal)
  reservaciones!: Relation<Reservacion[]>;

  @OneToMany(() => MovimientoFinanciero, (movimiento) => movimiento.sucursal)
  movimientosFinancieros!: Relation<MovimientoFinanciero[]>;
}
