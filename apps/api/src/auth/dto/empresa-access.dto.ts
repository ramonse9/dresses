import type { EmpresaUsuarioRol } from '../../usuarios/entities/empresa-usuario.entity.js';

export interface EmpresaAccessDto {
  id: string;
  nombre: string;
  slug: string;
  rol: EmpresaUsuarioRol;
}
