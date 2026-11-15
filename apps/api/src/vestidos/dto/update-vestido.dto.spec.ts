import { BadRequestException } from '@nestjs/common';
import { VestidoEstadoOperativo } from '../entities/vestido.tenant-entity.js';
import { parseUpdateVestidoBody } from './update-vestido.dto.js';

describe('UpdateVestido DTO validation', () => {
  it('normalizes every supported field', () => {
    expect(
      parseUpdateVestidoBody({
        sucursalId: 'A18C2A56-D33F-4D88-A8E7-42931121E295',
        codigo: ' v-002 ',
        nombre: ' Vestido rojo ',
        descripcion: ' ',
        talla: ' L ',
        color: ' Rojo ',
        marca: null,
        precioRenta: 1500,
        deposito: '250.5',
        estadoOperativo: VestidoEstadoOperativo.MANTENIMIENTO,
        activo: true,
      }),
    ).toEqual({
      sucursalId: 'a18c2a56-d33f-4d88-a8e7-42931121e295',
      codigo: 'V-002',
      nombre: 'Vestido rojo',
      descripcion: null,
      talla: 'L',
      color: 'Rojo',
      marca: null,
      precioRenta: '1500.00',
      deposito: '250.50',
      estadoOperativo: VestidoEstadoOperativo.MANTENIMIENTO,
      activo: true,
    });
  });

  it.each([
    null,
    [],
    {},
    { sucursalId: 'invalid' },
    { codigo: ' ' },
    { precioRenta: -1 },
    { deposito: '10.999' },
    { estadoOperativo: 'RENTADO' },
    { activo: 'true' },
    { empresaId: 'a18c2a56-d33f-4d88-a8e7-42931121e295' },
    { empresaSlug: 'atelier-norte' },
    { schemaName: 'tenant_untrusted' },
  ])('rejects invalid, empty or unknown input', (body) => {
    expect(() => parseUpdateVestidoBody(body)).toThrow(BadRequestException);
  });

  it('allows clearing nullable values and reactivating a dress', () => {
    expect(
      parseUpdateVestidoBody({
        descripcion: null,
        marca: '',
        deposito: null,
        activo: true,
      }),
    ).toEqual({
      descripcion: null,
      marca: null,
      deposito: null,
      activo: true,
    });
  });
});
