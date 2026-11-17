import type { VestidoEstadoOperativo } from '../entities/vestido.tenant-entity.js';

export type VestidoResponseDto = {
  id: string;
  sucursalId: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  talla: string;
  color: string;
  marca: string | null;
  precioRenta: string;
  deposito: string | null;
  estadoOperativo: VestidoEstadoOperativo;
  activo: boolean;
  createdAt: Date;
  updatedAt: Date;
  sucursal: {
    id: string;
    nombre: string;
    activo: boolean;
  };
};

export type PaginatedVestidosResponseDto = {
  data: VestidoResponseDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type DisponibilidadVestidosResponseDto = PaginatedVestidosResponseDto & {
  range: {
    fechaInicio: Date;
    fechaFin: Date;
  };
};
