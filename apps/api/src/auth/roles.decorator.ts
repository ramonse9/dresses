import { SetMetadata } from '@nestjs/common';
import type { EmpresaUsuarioRol } from '../usuarios/entities/empresa-usuario.entity.js';

export const ROLES_METADATA_KEY = 'auth:roles';

export const Roles = (
  ...roles: EmpresaUsuarioRol[]
): MethodDecorator & ClassDecorator => SetMetadata(ROLES_METADATA_KEY, roles);
