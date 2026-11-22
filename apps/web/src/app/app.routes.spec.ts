import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { routes } from './app.routes';
import { AuthStore } from './core/auth/auth.store';
import { API_BASE_URL } from './core/config/api-config';
import { TenantStore } from './core/tenant/tenant.store';
import { BranchesStore } from './features/branches/branches.store';
import { CustomersStore } from './features/customers/customers.store';
import { DressesStore } from './features/dresses/dresses.store';
import { ReservationCreateStore } from './features/reservations/reservation-create.store';
import { ReservationsStore } from './features/reservations/reservations.store';
import { TeamStore } from './features/team/team.store';
import { InvitationAcceptanceApiService } from './features/auth/invitation-acceptance/invitation-acceptance-api.service';

describe('application routes', () => {
  const authenticated = signal(false);
  const selectedTenant = signal(false);
  const role = signal<'OWNER' | 'EMPLOYEE'>('OWNER');
  const company = {
    id: 'empresa-1',
    nombre: 'Atelier Norte',
    slug: 'atelier-norte',
    rol: 'OWNER' as const,
  };
  const branch = {
    id: '11111111-1111-4111-8111-111111111111',
    nombre: 'Sucursal Centro',
    direccion: 'Av. Principal 123',
    telefono: '555-0100',
    activo: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  const customer = {
    id: '22222222-2222-4222-8222-222222222222',
    nombre: 'Ana López',
    telefono: '555-0200',
    email: 'ana@example.com',
    direccion: 'Calle Rosa 25',
    notas: 'Cliente frecuente',
    activo: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  const dress = {
    id: '33333333-3333-4333-8333-333333333333',
    sucursalId: branch.id,
    codigo: 'GALA-001',
    nombre: 'Gala Roja',
    descripcion: 'Vestido largo',
    talla: 'M',
    color: 'Rojo',
    marca: 'Atelier',
    precioRenta: '1250.50',
    deposito: '500.00',
    estadoOperativo: 'DISPONIBLE' as const,
    activo: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    sucursal: { id: branch.id, nombre: branch.nombre, activo: true },
  };
  const reservation = {
    id: '44444444-4444-4444-8444-444444444444',
    cliente: {
      id: customer.id,
      nombre: customer.nombre,
      telefono: customer.telefono,
      email: customer.email,
    },
    sucursal: { id: branch.id, nombre: branch.nombre },
    fechaInicio: '2026-12-10T23:00:00.000Z',
    fechaFin: '2026-12-12T23:00:00.000Z',
    estado: 'CONFIRMADA' as const,
    notas: null,
    importeRenta: '1250.50',
    depositoRequerido: '500.00',
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
    confirmadaAt: '2026-11-01T00:00:00.000Z',
    entregadaAt: null,
    devueltaAt: null,
    canceladaAt: null,
    motivoCancelacion: null,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
  };
  const member = {
    id: '55555555-5555-4555-8555-555555555555',
    usuario: {
      id: '77777777-7777-4777-8777-777777777777',
      nombre: 'Owner Principal',
      email: 'owner@example.test',
      activo: true,
    },
    rol: 'OWNER' as const,
    activo: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    authenticated.set(false);
    selectedTenant.set(false);
    role.set('OWNER');
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        { provide: API_BASE_URL, useValue: 'http://localhost:3000/api' },
        {
          provide: AuthStore,
          useValue: {
            isAuthenticated: authenticated.asReadonly(),
            user: signal(null).asReadonly(),
          },
        },
        {
          provide: TenantStore,
          useValue: {
            initialize: () => of(undefined),
            hasSelectedTenant: selectedTenant.asReadonly(),
            selectedCompany: signal(company).asReadonly(),
            role: role.asReadonly(),
            status: signal('ready').asReadonly(),
            loading: signal(false).asReadonly(),
            companies: signal([company]).asReadonly(),
            selectCompany: () => of(undefined),
          },
        },
        {
          provide: BranchesStore,
          useValue: {
            listState: signal({ status: 'loaded', data: [branch], error: null }).asReadonly(),
            detailState: signal({ status: 'loaded', data: branch, error: null }).asReadonly(),
            loadList: () => of(undefined),
            loadDetail: () => of(undefined),
            create: () => of(branch),
            update: () => of(branch),
            deactivate: () => of({ ...branch, activo: false }),
            reactivate: () => of(branch),
          },
        },
        {
          provide: CustomersStore,
          useValue: {
            listState: signal({
              status: 'loaded',
              data: [customer],
              pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
              filters: { page: 1, limit: 20 },
              error: null,
            }).asReadonly(),
            detailState: signal({
              status: 'loaded',
              data: customer,
              error: null,
            }).asReadonly(),
            loadList: () => of(undefined),
            loadDetail: () => of(undefined),
            create: () => of(customer),
            update: () => of(customer),
            deactivate: () => of({ ...customer, activo: false }),
            reactivate: () => of(customer),
          },
        },
        {
          provide: DressesStore,
          useValue: {
            listState: signal({
              status: 'loaded',
              data: [dress],
              pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
              filters: { page: 1, limit: 20 },
              error: null,
            }).asReadonly(),
            detailState: signal({ status: 'loaded', data: dress, error: null }).asReadonly(),
            loadList: () => of(undefined),
            loadDetail: () => of(undefined),
          },
        },
        {
          provide: ReservationCreateStore,
          useValue: {
            customers: signal([customer]).asReadonly(),
            customersStatus: signal('loaded').asReadonly(),
            availability: signal(null).asReadonly(),
            availabilityStatus: signal('idle').asReadonly(),
            searchCustomers: () => of(undefined),
            loadAvailability: () =>
              of({
                data: [dress],
                pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
                range: {
                  fechaInicio: reservation.fechaInicio,
                  fechaFin: reservation.fechaFin,
                },
              }),
            clearAvailability: () => undefined,
            create: () => of(reservation),
          },
        },
        {
          provide: ReservationsStore,
          useValue: {
            listState: signal({
              status: 'loaded',
              data: [{ ...reservation, vestidos: undefined, vestidosCount: 1 }],
              pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
              filters: { page: 1, limit: 20 },
              error: null,
            }).asReadonly(),
            detailState: signal({ status: 'loaded', data: reservation, error: null }).asReadonly(),
            loadList: () => of(undefined),
            loadDetail: () => of(undefined),
            update: () => of(reservation),
            confirm: () => of(reservation),
            deliver: () => of(reservation),
            returnReservation: () => of(reservation),
            cancel: () => of(reservation),
          },
        },
        {
          provide: TeamStore,
          useValue: {
            listState: signal({
              status: 'loaded',
              data: [member],
              pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
              filters: { page: 1, limit: 20 },
              error: null,
            }).asReadonly(),
            detailState: signal({ status: 'loaded', data: member, error: null }).asReadonly(),
            loadList: () => of(undefined),
            loadDetail: () => of(undefined),
            changeRole: () => of(member),
            changeStatus: () => of(member),
          },
        },
        {
          provide: InvitationAcceptanceApiService,
          useValue: {
            verify: () => of({}),
            accept: () => of({ accepted: true, message: 'Accepted' }),
          },
        },
      ],
    });
  });

  it.each([
    ['/', 'Cada vestido.'],
    ['/login', 'Inicia sesión'],
    ['/aceptar-invitacion', 'Aceptar invitación'],
    ['/seleccionar-empresa', 'Seleccionar empresa'],
    ['/app', 'Panel de operación'],
    ['/app/dashboard', 'Panel de operación'],
    ['/app/sucursales', 'Sucursales'],
    ['/app/sucursales/nueva', 'Crear sucursal'],
    [`/app/sucursales/${branch.id}`, 'Sucursal Centro'],
    [`/app/sucursales/${branch.id}/editar`, 'Sucursal Centro'],
    ['/app/clientes', 'Clientes'],
    ['/app/clientes/nuevo', 'Crear cliente'],
    [`/app/clientes/${customer.id}`, 'Ana López'],
    [`/app/clientes/${customer.id}/editar`, 'Ana López'],
    ['/app/vestidos', 'Vestidos'],
    [`/app/vestidos/${dress.id}`, 'Gala Roja'],
    ['/app/disponibilidad', 'Disponibilidad'],
    ['/app/reservaciones', 'Reservaciones'],
    ['/app/reservaciones/nueva', 'Crear reservación'],
    [`/app/reservaciones/${reservation.id}/editar`, 'Editar reservación'],
    [`/app/reservaciones/${reservation.id}`, 'Ana López'],
    ['/app/equipo', 'Equipo'],
    [`/app/equipo/${member.id}`, 'Owner Principal'],
  ])('renders %s', async (url, expectedText) => {
    authenticated.set(url === '/seleccionar-empresa' || url.startsWith('/app'));
    selectedTenant.set(url.startsWith('/app'));
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);

    expect(harness.routeNativeElement?.textContent).toContain(expectedText);
  });

  it('redirects the app root to the dashboard child route', async () => {
    authenticated.set(true);
    selectedTenant.set(true);
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/app');

    expect(TestBed.inject(Router).url).toBe('/app/dashboard');
  });

  it.each(['OWNER', 'EMPLOYEE'] as const)(
    'allows %s to open the reservation creation flow',
    async (currentRole) => {
      authenticated.set(true);
      selectedTenant.set(true);
      role.set(currentRole);
      const harness = await RouterTestingHarness.create();

      await harness.navigateByUrl('/app/reservaciones/nueva');

      expect(harness.routeNativeElement?.textContent).toContain('Crear reservación');
    },
  );

  it('redirects unknown routes to the public home', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/ruta-inexistente');

    expect(harness.routeNativeElement?.textContent).toContain('Cada vestido.');
  });
});
