import { getMetadataArgsStorage } from 'typeorm';
import { Cliente } from '../../clientes/entities/cliente.tenant-entity.js';
import { Sucursal } from '../../sucursales/entities/sucursal.tenant-entity.js';
import { Vestido } from '../../vestidos/entities/vestido.tenant-entity.js';
import { ReservacionVestido } from './reservacion-vestido.tenant-entity.js';
import { Reservacion, ReservacionEstado } from './reservacion.tenant-entity.js';

describe('Reservaciones tenant entities', () => {
  it('defines the reservation header and detail tables', () => {
    const metadata = getMetadataArgsStorage();
    const tables = metadata.tables.filter(
      (table) =>
        table.target === Reservacion || table.target === ReservacionVestido,
    );
    const reservacionColumns = metadata.columns.filter(
      (column) => column.target === Reservacion,
    );
    const detailColumns = metadata.columns.filter(
      (column) => column.target === ReservacionVestido,
    );

    expect(tables).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'reservaciones' }),
        expect.objectContaining({ name: 'reservacion_vestidos' }),
      ]),
    );
    expect(reservacionColumns.map(({ propertyName }) => propertyName)).toEqual(
      expect.arrayContaining([
        'clienteId',
        'sucursalId',
        'fechaInicio',
        'fechaFin',
        'estado',
        'importeRenta',
        'depositoRequerido',
        'confirmadaAt',
        'entregadaAt',
        'devueltaAt',
        'canceladaAt',
        'motivoCancelacion',
      ]),
    );
    expect(detailColumns.map(({ propertyName }) => propertyName)).toEqual(
      expect.arrayContaining([
        'reservacionId',
        'vestidoId',
        'precioRenta',
        'deposito',
      ]),
    );
  });

  it('uses timestamptz dates and exact numeric historical amounts', () => {
    const columns = getMetadataArgsStorage().columns;
    const byProperty = (
      target: typeof Reservacion | typeof ReservacionVestido,
      propertyName: string,
    ) =>
      columns.find(
        (column) =>
          column.target === target && column.propertyName === propertyName,
      )?.options;

    expect(byProperty(Reservacion, 'fechaInicio')).toMatchObject({
      name: 'fecha_inicio',
      type: 'timestamptz',
    });
    expect(byProperty(Reservacion, 'fechaFin')).toMatchObject({
      name: 'fecha_fin',
      type: 'timestamptz',
    });

    for (const [target, property] of [
      [Reservacion, 'importeRenta'],
      [Reservacion, 'depositoRequerido'],
      [ReservacionVestido, 'precioRenta'],
      [ReservacionVestido, 'deposito'],
    ] as const) {
      expect(byProperty(target, property)).toMatchObject({
        type: 'numeric',
        precision: 12,
        scale: 2,
      });
    }
  });

  it('defines only the initial states and defaults to BORRADOR', () => {
    const estado = getMetadataArgsStorage().columns.find(
      (column) =>
        column.target === Reservacion && column.propertyName === 'estado',
    );

    expect(Object.values(ReservacionEstado)).toEqual([
      'BORRADOR',
      'CONFIRMADA',
      'ENTREGADA',
      'DEVUELTA',
      'CANCELADA',
    ]);
    expect(estado?.options).toMatchObject({
      type: 'varchar',
      length: 20,
      default: ReservacionEstado.BORRADOR,
    });
  });

  it('declares date, state, amount, uniqueness and lookup constraints', () => {
    const metadata = getMetadataArgsStorage();
    const checks = metadata.checks.filter(
      (check) =>
        check.target === Reservacion || check.target === ReservacionVestido,
    );
    const indexes = metadata.indices.filter(
      (index) =>
        index.target === Reservacion || index.target === ReservacionVestido,
    );
    const unique = metadata.uniques.find(
      (entry) =>
        entry.target === ReservacionVestido &&
        entry.name === 'UQ_reservacion_vestidos_reservacion_vestido',
    );

    expect(checks.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        'CHK_reservaciones_fechas',
        'CHK_reservaciones_estado',
        'CHK_reservaciones_importe_renta',
        'CHK_reservaciones_deposito_requerido',
        'CHK_reservacion_vestidos_precio_renta',
        'CHK_reservacion_vestidos_deposito',
      ]),
    );
    expect(indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'IDX_reservaciones_cliente_created_at',
          columns: ['clienteId', 'createdAt', 'id'],
        }),
        expect.objectContaining({
          name: 'IDX_reservaciones_sucursal_created_at_id',
          columns: ['sucursalId', 'createdAt', 'id'],
        }),
        expect.objectContaining({
          name: 'IDX_reservaciones_created_at_id',
          columns: ['createdAt', 'id'],
        }),
        expect.objectContaining({
          name: 'IDX_reservaciones_fechas',
          columns: ['fechaInicio', 'fechaFin'],
        }),
        expect.objectContaining({
          name: 'IDX_reservaciones_sucursal_estado_fechas',
          columns: ['sucursalId', 'estado', 'fechaInicio', 'fechaFin'],
        }),
        expect.objectContaining({
          name: 'IDX_reservaciones_estado_fechas',
          columns: ['estado', 'fechaInicio', 'fechaFin'],
        }),
        expect.objectContaining({
          name: 'IDX_reservacion_vestidos_reservacion_id',
          columns: ['reservacionId'],
        }),
        expect.objectContaining({
          name: 'IDX_reservacion_vestidos_vestido_id',
          columns: ['vestidoId', 'reservacionId'],
        }),
      ]),
    );
    expect(unique?.columns).toEqual(['reservacionId', 'vestidoId']);
  });

  it('relates cliente, sucursal, vestidos and details in both directions', () => {
    const relations = getMetadataArgsStorage().relations;
    const relation = (target: object, propertyName: string) =>
      relations.find(
        (entry) =>
          entry.target === target && entry.propertyName === propertyName,
      );

    expect(relation(Reservacion, 'cliente')).toMatchObject({
      relationType: 'many-to-one',
      options: { nullable: false, onDelete: 'RESTRICT' },
    });
    expect(relation(Reservacion, 'sucursal')).toMatchObject({
      relationType: 'many-to-one',
      options: { nullable: false, onDelete: 'RESTRICT' },
    });
    expect(relation(Reservacion, 'vestidos')?.relationType).toBe('one-to-many');
    expect(relation(ReservacionVestido, 'reservacion')).toMatchObject({
      relationType: 'many-to-one',
      options: { nullable: false, onDelete: 'CASCADE' },
    });
    expect(relation(ReservacionVestido, 'vestido')).toMatchObject({
      relationType: 'many-to-one',
      options: { nullable: false, onDelete: 'RESTRICT' },
    });
    expect(relation(Cliente, 'reservaciones')?.relationType).toBe(
      'one-to-many',
    );
    expect(relation(Sucursal, 'reservaciones')?.relationType).toBe(
      'one-to-many',
    );
    expect(relation(Vestido, 'reservacionVestidos')?.relationType).toBe(
      'one-to-many',
    );
  });
});
