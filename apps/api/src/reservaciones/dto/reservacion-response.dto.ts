import type { ReservacionEstado } from '../entities/reservacion.tenant-entity.js';

export type ReservacionResponseDto = {
  id: string;
  cliente: {
    id: string;
    nombre: string;
    telefono: string | null;
    email: string | null;
  };
  sucursal: {
    id: string;
    nombre: string;
  };
  vestidos: Array<{
    id: string;
    codigo: string;
    nombre: string;
    talla: string;
    color: string;
    precioRenta: string;
    deposito: string;
  }>;
  fechaInicio: Date;
  fechaFin: Date;
  estado: ReservacionEstado;
  notas: string | null;
  importeRenta: string;
  depositoRequerido: string;
  confirmadaAt: Date | null;
  entregadaAt: Date | null;
  devueltaAt: Date | null;
  canceladaAt: Date | null;
  motivoCancelacion: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ReservacionListItemDto = Omit<
  ReservacionResponseDto,
  | 'vestidos'
  | 'confirmadaAt'
  | 'entregadaAt'
  | 'devueltaAt'
  | 'canceladaAt'
  | 'motivoCancelacion'
> & {
  vestidosCount: number;
};

export type PaginatedReservacionesResponseDto = {
  data: ReservacionListItemDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};
