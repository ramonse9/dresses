import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

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
}
