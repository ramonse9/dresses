import { BadRequestException } from '@nestjs/common';
import {
  parseCreateClienteBody,
  parseListClientesQuery,
  parseUpdateClienteBody,
  parseUpdateClienteEstadoBody,
} from './cliente.dto.js';

describe('Cliente DTO validation', () => {
  it('normalizes creation input and nullable text', () => {
    expect(
      parseCreateClienteBody({
        nombre: '  Ana López  ',
        telefono: ' ',
        email: '  ANA@EXAMPLE.COM  ',
        direccion: '',
        notas: '  Cliente frecuente  ',
      }),
    ).toEqual({
      nombre: 'Ana López',
      telefono: null,
      email: 'ana@example.com',
      direccion: null,
      notas: 'Cliente frecuente',
    });
  });

  it('requires at least one contact on creation', () => {
    expect(() => parseCreateClienteBody({ nombre: 'Sin contacto' })).toThrow(
      BadRequestException,
    );
    expect(() =>
      parseCreateClienteBody({ nombre: 'Vacío', telefono: ' ', email: null }),
    ).toThrow(BadRequestException);
  });

  it('parses partial updates but never accepts activo', () => {
    expect(
      parseUpdateClienteBody({ telefono: ' 555-0100 ', email: '' }),
    ).toEqual({ telefono: '555-0100', email: null });
    expect(() => parseUpdateClienteBody({ activo: false })).toThrow(
      BadRequestException,
    );
    expect(() => parseUpdateClienteBody({})).toThrow(BadRequestException);
  });

  it('accepts only an exact boolean status body', () => {
    expect(parseUpdateClienteEstadoBody({ activo: true })).toEqual({
      activo: true,
    });
    expect(() => parseUpdateClienteEstadoBody({ activo: 'true' })).toThrow(
      BadRequestException,
    );
    expect(() =>
      parseUpdateClienteEstadoBody({ activo: true, nombre: 'No permitido' }),
    ).toThrow(BadRequestException);
  });

  it('uses pagination defaults and parses filters', () => {
    expect(parseListClientesQuery({})).toEqual({ page: 1, limit: 20 });
    expect(
      parseListClientesQuery({
        page: '2',
        limit: '50',
        activo: 'false',
        q: '  ana@example.com  ',
      }),
    ).toEqual({
      page: 2,
      limit: 50,
      activo: false,
      q: 'ana@example.com',
    });
  });

  it.each([
    { page: '0' },
    { limit: '101' },
    { activo: 'yes' },
    { q: ' ' },
    { empresaId: 'a18c2a56-d33f-4d88-a8e7-42931121e295' },
    { empresaSlug: 'atelier-norte' },
    { schemaName: 'tenant_untrusted' },
  ])('rejects invalid or unknown list filters', (query) => {
    expect(() => parseListClientesQuery(query)).toThrow(BadRequestException);
  });

  it.each([
    { nombre: 'Ana', empresaId: 'a18c2a56-d33f-4d88-a8e7-42931121e295' },
    { nombre: 'Ana', telefono: '555', empresaSlug: 'atelier-norte' },
    { nombre: 'Ana', email: 'ana@example.com', schemaName: 'tenant_bad' },
  ])('rejects tenant selectors in write DTOs', (body) => {
    expect(() => parseCreateClienteBody(body)).toThrow(BadRequestException);
  });
});
