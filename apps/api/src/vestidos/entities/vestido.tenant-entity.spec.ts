import { getMetadataArgsStorage } from 'typeorm';
import { Sucursal } from '../../sucursales/entities/sucursal.tenant-entity.js';
import { Vestido, VestidoEstadoOperativo } from './vestido.tenant-entity.js';

describe('Vestido tenant entity', () => {
  it('models one physical dress with exact monetary columns', () => {
    const metadata = getMetadataArgsStorage();
    const columns = metadata.columns.filter(
      (column) => column.target === Vestido,
    );
    const precioRenta = columns.find(
      (column) => column.propertyName === 'precioRenta',
    );
    const deposito = columns.find(
      (column) => column.propertyName === 'deposito',
    );

    expect(precioRenta?.options).toMatchObject({
      name: 'precio_renta',
      type: 'numeric',
      precision: 12,
      scale: 2,
    });
    expect(deposito?.options).toMatchObject({
      type: 'numeric',
      precision: 12,
      scale: 2,
      nullable: true,
    });
  });

  it('relates vestidos and sucursales in both directions', () => {
    const relations = getMetadataArgsStorage().relations;
    const sucursalRelation = relations.find(
      (relation) =>
        relation.target === Vestido && relation.propertyName === 'sucursal',
    );
    const vestidosRelation = relations.find(
      (relation) =>
        relation.target === Sucursal && relation.propertyName === 'vestidos',
    );

    expect(sucursalRelation?.relationType).toBe('many-to-one');
    expect(sucursalRelation?.options).toMatchObject({
      nullable: false,
      onDelete: 'RESTRICT',
    });
    expect(vestidosRelation?.relationType).toBe('one-to-many');
  });

  it('defines only the initial operational states', () => {
    expect(Object.values(VestidoEstadoOperativo)).toEqual([
      'DISPONIBLE',
      'MANTENIMIENTO',
    ]);
  });

  it('declares indexes for stable catalog ordering and filters', () => {
    const indexes = getMetadataArgsStorage().indices.filter(
      (index) => index.target === Vestido,
    );

    expect(indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'IDX_vestidos_catalog_order',
          columns: ['createdAt', 'id'],
        }),
        expect.objectContaining({
          name: 'IDX_vestidos_sucursal_id',
          columns: ['sucursalId', 'createdAt', 'id'],
        }),
        expect.objectContaining({
          name: 'IDX_vestidos_activo',
          columns: ['activo', 'createdAt', 'id'],
        }),
        expect.objectContaining({
          name: 'IDX_vestidos_estado_operativo',
          columns: ['estadoOperativo', 'createdAt', 'id'],
        }),
      ]),
    );
  });
});
