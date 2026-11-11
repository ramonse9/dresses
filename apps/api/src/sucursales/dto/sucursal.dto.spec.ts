import { BadRequestException } from '@nestjs/common';
import {
  parseCreateSucursalBody,
  parseEmpresaSlug,
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

  it('normalizes a valid empresa slug', () => {
    expect(parseEmpresaSlug('Atelier-Norte')).toBe('atelier-norte');
  });
});
