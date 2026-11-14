import { BadRequestException } from '@nestjs/common';
import { VestidoEstadoOperativo } from '../entities/vestido.tenant-entity.js';
import { parseCreateVestidoBody } from './create-vestido.dto.js';

describe('CreateVestido DTO validation', () => {
  const validInput = {
    sucursalId: 'A18C2A56-D33F-4D88-A8E7-42931121E295',
    codigo: '  v-001  ',
    nombre: '  Vestido Azul  ',
    descripcion: '  Corte largo  ',
    talla: ' M ',
    color: ' Azul ',
    marca: ' Marca ',
    precioRenta: '1250.5',
    deposito: 500,
    estadoOperativo: VestidoEstadoOperativo.MANTENIMIENTO,
  };

  it('normalizes text, code, UUID and exact monetary values', () => {
    expect(parseCreateVestidoBody(validInput)).toEqual({
      sucursalId: 'a18c2a56-d33f-4d88-a8e7-42931121e295',
      codigo: 'V-001',
      nombre: 'Vestido Azul',
      descripcion: 'Corte largo',
      talla: 'M',
      color: 'Azul',
      marca: 'Marca',
      precioRenta: '1250.50',
      deposito: '500.00',
      estadoOperativo: VestidoEstadoOperativo.MANTENIMIENTO,
    });
  });

  it('uses DISPONIBLE and nullable optional fields by default', () => {
    const {
      descripcion: _descripcion,
      marca: _marca,
      deposito: _deposito,
      estadoOperativo: _estado,
      ...required
    } = validInput;

    expect(parseCreateVestidoBody(required)).toEqual(
      expect.objectContaining({
        estadoOperativo: VestidoEstadoOperativo.DISPONIBLE,
      }),
    );
    expect(parseCreateVestidoBody(required)).not.toHaveProperty('deposito');
  });

  it.each([
    ['sucursalId', { ...validInput, sucursalId: 'not-a-uuid' }],
    ['codigo', { ...validInput, codigo: ' ' }],
    ['nombre', { ...validInput, nombre: ' ' }],
    ['talla', { ...validInput, talla: ' ' }],
    ['color', { ...validInput, color: ' ' }],
    ['precioRenta', { ...validInput, precioRenta: -1 }],
    ['precioRenta', { ...validInput, precioRenta: '10.999' }],
    ['deposito', { ...validInput, deposito: '-0.01' }],
    ['estadoOperativo', { ...validInput, estadoOperativo: 'RENTADO' }],
  ])('rejects an invalid %s', (_field, input) => {
    expect(() => parseCreateVestidoBody(input)).toThrow(BadRequestException);
  });

  it.each([
    { ...validInput, empresaId: 'a18c2a56-d33f-4d88-a8e7-42931121e295' },
    { ...validInput, empresaSlug: 'atelier-norte' },
    { ...validInput, schemaName: 'tenant_untrusted' },
    { ...validInput, activo: false },
  ])('rejects unknown fields and tenant selectors', (input) => {
    expect(() => parseCreateVestidoBody(input)).toThrow(BadRequestException);
  });

  it('rejects values that exceed database lengths or numeric precision', () => {
    expect(() =>
      parseCreateVestidoBody({ ...validInput, codigo: 'X'.repeat(51) }),
    ).toThrow(BadRequestException);
    expect(() =>
      parseCreateVestidoBody({
        ...validInput,
        precioRenta: '10000000000.00',
      }),
    ).toThrow(BadRequestException);
  });
});
