import {
  BeforeInsert,
  BeforeUpdate,
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

function normalizeOptionalText(
  value: string | null | undefined,
): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
}

@Entity({ name: 'clientes' })
@Index('IDX_clientes_activo_created_at', ['activo', 'createdAt', 'id'])
@Check(
  'CHK_clientes_nombre_normalized',
  `"nombre" = BTRIM("nombre") AND LENGTH("nombre") > 0`,
)
@Check(
  'CHK_clientes_contacto_requerido',
  `"telefono" IS NOT NULL OR "email" IS NOT NULL`,
)
@Check(
  'CHK_clientes_telefono_normalized',
  `"telefono" IS NULL OR ("telefono" = BTRIM("telefono") AND LENGTH("telefono") > 0)`,
)
@Check(
  'CHK_clientes_email_normalized',
  `"email" IS NULL OR ("email" = LOWER(BTRIM("email")) AND LENGTH("email") > 0)`,
)
@Check(
  'CHK_clientes_direccion_normalized',
  `"direccion" IS NULL OR ("direccion" = BTRIM("direccion") AND LENGTH("direccion") > 0)`,
)
@Check(
  'CHK_clientes_notas_normalized',
  `"notas" IS NULL OR ("notas" = BTRIM("notas") AND LENGTH("notas") > 0)`,
)
export class Cliente {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('IDX_clientes_nombre_normalized', { synchronize: false })
  @Column({ length: 160 })
  nombre!: string;

  @Index('IDX_clientes_telefono', { synchronize: false })
  @Column({ type: 'varchar', length: 40, nullable: true })
  telefono!: string | null;

  @Index('IDX_clientes_email_normalized', { synchronize: false })
  @Column({ type: 'varchar', length: 254, nullable: true })
  email!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  direccion!: string | null;

  @Column({ type: 'varchar', length: 2_000, nullable: true })
  notas!: string | null;

  @Column({ default: true })
  activo!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @BeforeInsert()
  @BeforeUpdate()
  normalize(): void {
    if (typeof this.nombre === 'string') {
      this.nombre = this.nombre.trim();
    }

    this.telefono = normalizeOptionalText(this.telefono);
    this.email = normalizeOptionalText(this.email)?.toLowerCase() ?? null;
    this.direccion = normalizeOptionalText(this.direccion);
    this.notas = normalizeOptionalText(this.notas);
  }
}
