import { BadRequestException } from '@nestjs/common';
import {
  parseCreateSucursalBody,
  parseUpdateSucursalBody,
} from './sucursal.dto.js';

describe('Sucursal DTO validation', () => {
  it('normalizes creation data', () => {
    expect(
      parseCreateSucursalBody({
        nombre: '  Centro  ',
        direccion: '  Av. Principal 123  ',
        telefono: '  ',
      }),
    ).toEqual({
      nombre: 'Centro',
      direccion: 'Av. Principal 123',
      telefono: null,
    });
  });

  it.each([
    {},
    { nombre: '' },
    { nombre: 'Centro', schemaName: 'public' },
    { nombre: 'Centro', telefono: 123 },
  ])('rejects invalid creation data %#', (input) => {
    expect(() => parseCreateSucursalBody(input)).toThrow(BadRequestException);
  });

  it('accepts logical deactivation and nullable fields on update', () => {
    expect(parseUpdateSucursalBody({ activo: false, telefono: null })).toEqual({
      activo: false,
      telefono: null,
    });
  });

  it('rejects an empty update', () => {
    expect(() => parseUpdateSucursalBody({})).toThrow(BadRequestException);
  });

  it.each([
    { nombre: 'Centro', empresaId: 'a18c2a56-d33f-4d88-a8e7-42931121e295' },
    { nombre: 'Centro', empresaSlug: 'atelier-norte' },
    { nombre: 'Centro', schemaName: 'tenant_untrusted' },
  ])('rejects tenant selectors in the body', (input) => {
    expect(() => parseCreateSucursalBody(input)).toThrow(BadRequestException);
  });
});
