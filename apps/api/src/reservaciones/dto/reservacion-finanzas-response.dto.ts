import type {
  MovimientoFinancieroMetodoPago,
  MovimientoFinancieroTipo,
} from '../entities/movimiento-financiero.tenant-entity.js';

export type ReservacionFinanzasResponseDto = {
  importeRenta: string;
  rentaCobrada: string;
  rentaReembolsada: string;
  rentaPagadaNeta: string;
  saldoRenta: string;
  depositoRequerido: string;
  depositoRecibido: string;
  depositoDevuelto: string;
  depositoRetenido: string;
  depositoPendienteCobro: string;
  depositoPorDevolver: string;
};

export type MovimientoFinancieroResponseDto = {
  id: string;
  tipo: MovimientoFinancieroTipo;
  monto: string;
  metodoPago: MovimientoFinancieroMetodoPago;
  referencia: string | null;
  notas: string | null;
  movimientoOrigen: {
    id: string;
    tipo: MovimientoFinancieroTipo;
    monto: string;
  } | null;
  actor: {
    id: string;
    nombre: string;
    email: string | null;
    activo: boolean | null;
  };
  createdAt: Date;
};

export type PaginatedMovimientosFinancierosResponseDto = {
  data: MovimientoFinancieroResponseDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type RegistroCobroResponseDto = {
  movimiento: MovimientoFinancieroResponseDto;
  finanzas: ReservacionFinanzasResponseDto;
};
