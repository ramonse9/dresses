import { BadRequestException } from '@nestjs/common';

export type CreateEmpresaDto = {
  nombre: string;
  slug: string;
};

const allowedFields = new Set(['nombre', 'slug']);
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function parseCreateEmpresaBody(body: unknown): CreateEmpresaDto {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new BadRequestException(
      'El cuerpo de la solicitud debe ser un objeto',
    );
  }

  const input = body as Record<string, unknown>;
  const unexpectedField = Object.keys(input).find(
    (field) => !allowedFields.has(field),
  );

  if (unexpectedField) {
    throw new BadRequestException(`Campo no permitido: ${unexpectedField}`);
  }

  if (typeof input.nombre !== 'string') {
    throw new BadRequestException('nombre es requerido');
  }

  if (typeof input.slug !== 'string') {
    throw new BadRequestException('slug es requerido');
  }

  const nombre = input.nombre.trim();
  const slug = input.slug.trim().toLowerCase();

  if (nombre.length < 2 || nombre.length > 160) {
    throw new BadRequestException('nombre debe tener entre 2 y 160 caracteres');
  }

  if (slug.length > 80 || !slugPattern.test(slug)) {
    throw new BadRequestException(
      'slug debe usar letras minúsculas, números y guiones simples',
    );
  }

  return { nombre, slug };
}
