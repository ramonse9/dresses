import { BadRequestException } from '@nestjs/common';
import { parseCreateEmpresaBody } from './create-empresa.dto.js';

describe('parseCreateEmpresaBody', () => {
  it('normalizes valid input', () => {
    expect(
      parseCreateEmpresaBody({
        nombre: '  Atelier Norte  ',
        slug: '  Atelier-Norte  ',
      }),
    ).toEqual({ nombre: 'Atelier Norte', slug: 'atelier-norte' });
  });

  it.each([
    { nombre: 'A', slug: 'atelier' },
    { nombre: 'Atelier', slug: 'atelier norte' },
    { nombre: 'Atelier', slug: 'atelier--norte' },
    { nombre: 'Atelier', slug: 'atelier', schemaName: 'public' },
  ])('rejects invalid or unexpected input %#', (body) => {
    expect(() => parseCreateEmpresaBody(body)).toThrow(BadRequestException);
  });
});
