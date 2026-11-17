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
  createdAt: Date;
  updatedAt: Date;
};
