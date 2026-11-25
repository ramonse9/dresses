import { getMetadataArgsStorage } from 'typeorm';
import { Sucursal } from '../../sucursales/entities/sucursal.tenant-entity.js';
import {
  MovimientoFinanciero,
  MovimientoFinancieroMetodoPago,
  MovimientoFinancieroTipo,
} from './movimiento-financiero.tenant-entity.js';
import { Reservacion } from './reservacion.tenant-entity.js';

describe('MovimientoFinanciero tenant entity', () => {
  it('defines an append-only tenant table without updatedAt', () => {
    const metadata = getMetadataArgsStorage();
    const table = metadata.tables.find(
      (entry) => entry.target === MovimientoFinanciero,
    );
    const columns = metadata.columns.filter(
      (column) => column.target === MovimientoFinanciero,
    );

    expect(table?.name).toBe('movimientos_financieros');
    expect(columns.map(({ propertyName }) => propertyName)).toEqual([
      'id',
      'reservacionId',
      'sucursalId',
      'tipo',
      'monto',
      'metodoPago',
      'referencia',
      'notas',
      'movimientoOrigenId',
      'idempotencyKey',
      'registradoPorUsuarioId',
      'createdAt',
    ]);
    expect(
      columns.some(({ propertyName }) => propertyName === 'updatedAt'),
    ).toBe(false);
  });

  it('uses the requested types, payment methods and exact amount metadata', () => {
    expect(Object.values(MovimientoFinancieroTipo)).toEqual([
      'PAGO_RENTA',
      'PAGO_DEPOSITO',
      'REEMBOLSO_RENTA',
      'DEVOLUCION_DEPOSITO',
      'REVERSO',
    ]);
    expect(Object.values(MovimientoFinancieroMetodoPago)).toEqual([
      'EFECTIVO',
      'TARJETA',
      'TRANSFERENCIA',
      'OTRO',
    ]);

    const columns = getMetadataArgsStorage().columns.filter(
      (column) => column.target === MovimientoFinanciero,
    );
    const byProperty = (propertyName: string) =>
      columns.find((column) => column.propertyName === propertyName)?.options;

    expect(byProperty('monto')).toMatchObject({
      type: 'numeric',
      precision: 12,
      scale: 2,
    });
    expect(byProperty('referencia')).toMatchObject({
      type: 'varchar',
      length: 120,
      nullable: true,
    });
    expect(byProperty('notas')).toMatchObject({
      type: 'varchar',
      length: 500,
      nullable: true,
    });
    expect(byProperty('idempotencyKey')).toMatchObject({
      name: 'idempotency_key',
      type: 'uuid',
    });
    expect(byProperty('registradoPorUsuarioId')).toMatchObject({
      name: 'registrado_por_usuario_id',
      type: 'uuid',
    });
  });

  it('declares structural checks and lookup indexes', () => {
    const metadata = getMetadataArgsStorage();
    const checks = metadata.checks.filter(
      (check) => check.target === MovimientoFinanciero,
    );
    const indexes = metadata.indices.filter(
      (index) => index.target === MovimientoFinanciero,
    );

    expect(checks.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        'CHK_movimientos_financieros_monto_positivo',
        'CHK_movimientos_financieros_tipo',
        'CHK_movimientos_financieros_metodo_pago',
        'CHK_movimientos_financieros_origen_por_tipo',
        'CHK_movimientos_financieros_referencia_normalized',
        'CHK_movimientos_financieros_notas_normalized',
      ]),
    );
    expect(indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'IDX_movimientos_financieros_reservacion_created_at_id',
          columns: ['reservacionId', 'createdAt', 'id'],
        }),
        expect.objectContaining({
          name: 'IDX_movimientos_financieros_sucursal_created_at_id',
          columns: ['sucursalId', 'createdAt', 'id'],
        }),
        expect.objectContaining({
          name: 'IDX_movimientos_financieros_tipo_created_at',
          columns: ['tipo', 'createdAt'],
        }),
        expect.objectContaining({
          name: 'IDX_movimientos_financieros_origen_id',
          columns: ['movimientoOrigenId'],
        }),
        expect.objectContaining({
          name: 'IDX_movimientos_financieros_registrado_por_created_at',
          columns: ['registradoPorUsuarioId', 'createdAt'],
        }),
        expect.objectContaining({
          name: 'UQ_movimientos_financieros_idempotency_key',
          columns: ['idempotencyKey'],
          unique: true,
        }),
      ]),
    );
  });

  it('relates reservation, branch and source movement within the tenant', () => {
    const relations = getMetadataArgsStorage().relations;
    const relation = (target: object, propertyName: string) =>
      relations.find(
        (entry) =>
          entry.target === target && entry.propertyName === propertyName,
      );

    expect(relation(MovimientoFinanciero, 'reservacion')).toMatchObject({
      relationType: 'many-to-one',
      options: { nullable: false, onDelete: 'RESTRICT' },
    });
    expect(relation(MovimientoFinanciero, 'sucursal')).toMatchObject({
      relationType: 'many-to-one',
      options: { nullable: false, onDelete: 'RESTRICT' },
    });
    expect(relation(MovimientoFinanciero, 'movimientoOrigen')).toMatchObject({
      relationType: 'many-to-one',
      options: { nullable: true, onDelete: 'RESTRICT' },
    });
    expect(
      relation(MovimientoFinanciero, 'movimientosDerivados')?.relationType,
    ).toBe('one-to-many');
    expect(relation(Reservacion, 'movimientosFinancieros')?.relationType).toBe(
      'one-to-many',
    );
    expect(relation(Sucursal, 'movimientosFinancieros')?.relationType).toBe(
      'one-to-many',
    );
  });

  it('trims optional text and converts empty values to null before insert', () => {
    const movimiento = new MovimientoFinanciero();
    movimiento.referencia = '  TRANS-001  ';
    movimiento.notas = '   ';

    movimiento.normalize();

    expect(movimiento.referencia).toBe('TRANS-001');
    expect(movimiento.notas).toBeNull();
  });
});
