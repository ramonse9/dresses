import type { Page, Route } from '@playwright/test';

export type MockRole = 'OWNER' | 'EMPLOYEE';

export interface MockApiOptions {
  readonly authenticated?: boolean;
  readonly role?: MockRole;
}

export interface MockApiState {
  authenticated: boolean;
  role: MockRole;
  reservationStatus: 'BORRADOR' | 'CONFIRMADA' | 'ENTREGADA' | 'DEVUELTA' | 'CANCELADA';
  cancellationReason: string | null;
}

const now = '2026-11-20T15:00:00.000Z';
export const ids = {
  company: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  branch: '22222222-2222-4222-8222-222222222222',
  customer: '11111111-1111-4111-8111-111111111111',
  createdCustomer: '66666666-6666-4666-8666-666666666666',
  dress: '33333333-3333-4333-8333-333333333333',
  reservation: '44444444-4444-4444-8444-444444444444',
} as const;

const branch = {
  id: ids.branch,
  nombre: 'Centro Histórico',
  direccion: 'Av. Principal 123',
  telefono: '669 123 4567',
  activo: true,
  createdAt: now,
  updatedAt: now,
};
const customer = {
  id: ids.customer,
  nombre: 'Ana López',
  telefono: '669 111 2233',
  email: 'ana@example.test',
  direccion: null,
  notas: null,
  activo: true,
  createdAt: now,
  updatedAt: now,
};
const dress = {
  id: ids.dress,
  sucursalId: ids.branch,
  codigo: 'GALA-001',
  nombre: 'Gala Roja',
  descripcion: null,
  talla: 'M',
  color: 'Rojo',
  marca: 'Atelier',
  precioRenta: '1250.50',
  deposito: '500.00',
  estadoOperativo: 'DISPONIBLE',
  activo: true,
  createdAt: now,
  updatedAt: now,
  sucursal: { id: ids.branch, nombre: branch.nombre, activo: true },
};

export async function installMockApi(
  page: Page,
  options: MockApiOptions = {},
): Promise<MockApiState> {
  const state: MockApiState = {
    authenticated: options.authenticated ?? true,
    role: options.role ?? 'OWNER',
    reservationStatus: 'BORRADOR',
    cancellationReason: null,
  };

  await page.route('http://localhost:3000/api/**', async (route) => {
    await handleApiRoute(route, state);
  });
  return state;
}

async function handleApiRoute(route: Route, state: MockApiState): Promise<void> {
  const request = route.request();
  const url = new URL(request.url());
  const path = url.pathname.replace('/api/', '');
  const method = request.method();
  if (method === 'OPTIONS') return fulfill(route, 204, null);

  if (path === 'auth/refresh') {
    return state.authenticated
      ? fulfill(route, 200, token())
      : fulfill(route, 401, error('Sesión inválida'));
  }
  if (path === 'auth/login' && method === 'POST') {
    state.authenticated = true;
    return fulfill(route, 200, token());
  }
  if (path === 'auth/me') {
    return state.authenticated
      ? fulfill(route, 200, {
          sub: '77777777-7777-4777-8777-777777777777',
          email: `${state.role.toLowerCase()}@example.test`,
          sessionId: '88888888-8888-4888-8888-888888888888',
        })
      : fulfill(route, 401, error('Sesión inválida'));
  }
  if (path === 'auth/logout' && method === 'POST') {
    state.authenticated = false;
    return fulfill(route, 204, null);
  }
  if (path === 'auth/empresas') {
    return fulfill(route, 200, [
      { id: ids.company, nombre: 'Atelier Norte', slug: 'atelier-norte', rol: state.role },
    ]);
  }
  if (path === 'auth/select-empresa' && method === 'POST') return fulfill(route, 200, token());

  if (path === 'sucursales' && method === 'GET') return fulfill(route, 200, [branch]);
  if (path === 'clientes' && method === 'GET') {
    return fulfill(route, 200, {
      data: [customer],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  }
  if (path === 'clientes' && method === 'POST') {
    const input = request.postDataJSON() as Record<string, unknown>;
    return fulfill(route, 201, {
      ...customer,
      ...input,
      id: ids.createdCustomer,
      activo: true,
    });
  }
  if (path === `clientes/${ids.createdCustomer}` && method === 'GET') {
    return fulfill(route, 200, {
      ...customer,
      id: ids.createdCustomer,
      nombre: 'Mariana Torres',
      email: 'mariana@example.test',
    });
  }

  if (path === 'vestidos' && method === 'GET') {
    return fulfill(route, 200, {
      data: [dress],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  }
  if (path === 'vestidos/disponibilidad' && method === 'GET') {
    return fulfill(route, 200, {
      data: [dress],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      range: {
        fechaInicio: url.searchParams.get('fechaInicio'),
        fechaFin: url.searchParams.get('fechaFin'),
      },
    });
  }

  if (path === 'reservaciones' && method === 'GET') {
    return fulfill(route, 200, {
      data: [{ ...reservation(state), vestidos: undefined, vestidosCount: 1 }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  }
  if (path === 'reservaciones' && method === 'POST') {
    const input = request.postDataJSON() as { confirmar?: boolean };
    state.reservationStatus = input.confirmar === false ? 'BORRADOR' : 'CONFIRMADA';
    return fulfill(route, 201, reservation(state));
  }
  if (path === `reservaciones/${ids.reservation}` && method === 'GET') {
    return fulfill(route, 200, reservation(state));
  }
  if (path === `reservaciones/${ids.reservation}/confirmar` && method === 'POST') {
    state.reservationStatus = 'CONFIRMADA';
    return fulfill(route, 200, reservation(state));
  }
  if (path === `reservaciones/${ids.reservation}/entregar` && method === 'POST') {
    state.reservationStatus = 'ENTREGADA';
    return fulfill(route, 200, reservation(state));
  }
  if (path === `reservaciones/${ids.reservation}/devolver` && method === 'POST') {
    state.reservationStatus = 'DEVUELTA';
    return fulfill(route, 200, reservation(state));
  }
  if (path === `reservaciones/${ids.reservation}/cancelar` && method === 'POST') {
    if (state.role === 'EMPLOYEE') return fulfill(route, 403, error('Acceso denegado'));
    const input = request.postDataJSON() as { motivo?: string | null };
    state.reservationStatus = 'CANCELADA';
    state.cancellationReason = input.motivo ?? null;
    return fulfill(route, 200, reservation(state));
  }

  return fulfill(route, 404, error('Recurso no encontrado'));
}

function reservation(state: MockApiState) {
  return {
    id: ids.reservation,
    cliente: {
      id: customer.id,
      nombre: customer.nombre,
      telefono: customer.telefono,
      email: customer.email,
    },
    sucursal: { id: branch.id, nombre: branch.nombre },
    fechaInicio: '2026-12-10T23:00:00.000Z',
    fechaFin: '2026-12-12T23:00:00.000Z',
    estado: state.reservationStatus,
    notas: null,
    importeRenta: dress.precioRenta,
    depositoRequerido: dress.deposito,
    vestidos: [
      {
        id: dress.id,
        codigo: dress.codigo,
        nombre: dress.nombre,
        talla: dress.talla,
        color: dress.color,
        precioRenta: dress.precioRenta,
        deposito: dress.deposito,
      },
    ],
    confirmadaAt: ['CONFIRMADA', 'ENTREGADA', 'DEVUELTA'].includes(state.reservationStatus)
      ? now
      : null,
    entregadaAt: ['ENTREGADA', 'DEVUELTA'].includes(state.reservationStatus) ? now : null,
    devueltaAt: state.reservationStatus === 'DEVUELTA' ? now : null,
    canceladaAt: state.reservationStatus === 'CANCELADA' ? now : null,
    motivoCancelacion: state.cancellationReason,
    createdAt: now,
    updatedAt: now,
  };
}

function token() {
  return { accessToken: 'test-only.jwt.token', tokenType: 'Bearer', expiresIn: 900 };
}

function error(message: string) {
  return { statusCode: 400, message };
}

async function fulfill(route: Route, status: number, body: unknown): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'application/json',
    headers: {
      'access-control-allow-origin': 'http://127.0.0.1:4200',
      'access-control-allow-credentials': 'true',
      'access-control-allow-headers': 'Authorization, Content-Type',
      'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    },
    body: body === null ? '' : JSON.stringify(body),
  });
}
