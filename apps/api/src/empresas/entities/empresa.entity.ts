import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'empresas', schema: 'public' })
@Index('UQ_empresas_slug', ['slug'], { unique: true })
@Index('UQ_empresas_schema_name', ['schemaName'], { unique: true })
@Check('CHK_empresas_schema_name', `"schema_name" ~ '^tenant_[0-9a-f]{32}$'`)
export class Empresa {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 160 })
  nombre!: string;

  @Column({ length: 80 })
  slug!: string;

  @Column({ name: 'schema_name', length: 39 })
  schemaName!: string;

  @Column({ default: true })
  activo!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
