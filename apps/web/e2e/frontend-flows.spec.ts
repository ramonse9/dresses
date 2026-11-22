import { expect, test, type Page } from '@playwright/test';
import { ids, installMockApi } from './mock-api';

test('login → empresa → catálogo → logout', async ({ page }) => {
  await installMockApi(page, { authenticated: false });
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill('owner@example.test');
  await page.getByLabel('Contraseña').fill('test-only-password');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByRole('heading', { name: 'Panel de operación' })).toBeVisible();

  await page.getByRole('link', { name: 'Vestidos' }).first().click();
  await expect(page.getByRole('heading', { name: 'Vestidos' })).toBeVisible();
  await expect(page.getByText('GALA-001')).toBeVisible();

  await page.locator('summary[aria-label="Abrir menú de usuario"]').click();
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page.getByRole('heading', { name: 'Inicia sesión' })).toBeVisible();
});

test('creates a customer with test-only contact data', async ({ page }) => {
  await installMockApi(page);
  await page.goto('/app/clientes/nuevo');
  await page.getByLabel('Nombre').fill('Mariana Torres');
  await page.getByLabel('Email').fill('mariana@example.test');
  await page.getByRole('button', { name: 'Crear cliente' }).click();
  await expect(page).toHaveURL(new RegExp(`/app/clientes/${ids.createdCustomer}`));
  await expect(page.getByRole('heading', { name: 'Mariana Torres' })).toBeVisible();
});

test('consults availability for a timezone-aware range', async ({ page }) => {
  await installMockApi(page);
  await page.goto('/app/disponibilidad');
  await page.getByLabel('Sucursal').selectOption(ids.branch);
  await page.getByLabel('Fecha y hora inicial').fill('2026-12-10T16:00');
  await page.getByLabel('Fecha y hora final').fill('2026-12-12T16:00');
  await page.getByRole('button', { name: 'Consultar disponibilidad' }).click();
  await expect(page.getByText('GALA-001')).toBeVisible();
  await expect(page.getByText(/America\/Mazatlan/)).toBeVisible();
});

test('creates a confirmed reservation from available pieces', async ({ page }) => {
  await installMockApi(page);
  await page.goto('/app/reservaciones/nueva');
  await page.getByRole('button', { name: /Ana López/ }).click();
  await page.getByLabel('Sucursal activa').selectOption(ids.branch);
  await page.getByLabel('Fecha y hora inicial').fill('2026-12-10T16:00');
  await page.getByLabel('Fecha y hora final').fill('2026-12-12T16:00');
  await page.getByLabel('Fecha y hora final').press('Tab');
  await page.getByRole('checkbox', { name: /GALA-001/ }).check();
  await page.getByRole('button', { name: 'Crear reservación' }).click();
  await expect(page).toHaveURL(new RegExp(`/app/reservaciones/${ids.reservation}`));
  await expect(page.locator('span').filter({ hasText: 'Confirmada' }).first()).toBeVisible();
});

test('runs confirmar → entregar → devolver', async ({ page }) => {
  const state = await installMockApi(page);
  state.reservationStatus = 'BORRADOR';
  await page.goto(`/app/reservaciones/${ids.reservation}`);

  await runTransition(page, 'Confirmar reservación');
  await expect(page.getByText('Confirmada', { exact: true })).toBeVisible();
  await runTransition(page, 'Registrar entrega');
  await expect(page.getByText('Entregada', { exact: true })).toBeVisible();
  await runTransition(page, 'Registrar devolución');
  await expect(page.getByText('Devuelta', { exact: true })).toBeVisible();
  await expect(page.getByText(/estado terminal/)).toBeVisible();
});

test('allows OWNER cancellation with an optional reason', async ({ page }) => {
  const state = await installMockApi(page, { role: 'OWNER' });
  state.reservationStatus = 'CONFIRMADA';
  await page.goto(`/app/reservaciones/${ids.reservation}`);
  await page.getByRole('button', { name: 'Cancelar reservación' }).click();
  await page.getByLabel('Motivo (opcional)').fill('Cambio de evento');
  await page.getByRole('button', { name: 'Confirmar acción' }).click();
  await expect(page.getByText('Cancelada', { exact: true })).toBeVisible();
  await expect(page.getByText('Cambio de evento')).toBeVisible();
});

test('hides cancellation and rejects a forced EMPLOYEE request', async ({ page }) => {
  const state = await installMockApi(page, { role: 'EMPLOYEE' });
  state.reservationStatus = 'CONFIRMADA';
  await page.goto(`/app/reservaciones/${ids.reservation}`);
  await expect(page.getByRole('button', { name: 'Cancelar reservación' })).toHaveCount(0);
  const status = await page.evaluate(async (reservationId) => {
    const response = await fetch(
      `http://localhost:3000/api/reservaciones/${reservationId}/cancelar`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo: 'Petición forzada' }),
      },
    );
    return response.status;
  }, ids.reservation);
  expect(status).toBe(403);
});

test('keeps mobile navigation keyboard-accessible', async ({ page }) => {
  await installMockApi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/app/dashboard');
  const trigger = page.getByRole('button', { name: 'Abrir navegación' });
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(page.getByRole('dialog', { name: 'Navegación móvil' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Navegación móvil' })).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('OWNER administers team role and membership state', async ({ page }) => {
  await installMockApi(page, { role: 'OWNER' });
  await page.goto('/app/dashboard');
  await page.getByRole('link', { name: 'Equipo' }).first().click();
  await expect(page.getByRole('heading', { name: 'Equipo' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Mariana Torres' })).toBeVisible();
  await page.goto(`/app/equipo/${ids.member}`);
  await expect(page.getByRole('heading', { name: 'Mariana Torres' })).toBeVisible();

  await page.getByLabel('Rol').selectOption('OWNER');
  await page.getByRole('button', { name: 'Guardar rol' }).click();
  await expect(page.getByLabel('Rol')).toHaveValue('OWNER');

  await page.getByRole('button', { name: 'Desactivar membresía' }).click();
  await expect(page.getByRole('dialog')).toContainText('únicamente a la empresa actual');
  await page.getByRole('button', { name: 'Confirmar acción' }).click();
  await expect(page.getByRole('button', { name: 'Activar membresía' })).toBeVisible();
});

test('OWNER creates, resends and revokes an invitation', async ({ page }) => {
  await installMockApi(page, { role: 'OWNER' });
  await page.goto('/app/equipo');
  await page.getByRole('link', { name: 'Invitaciones' }).click();
  await expect(page).toHaveURL(/\/app\/equipo\/invitaciones/);

  const creation = page.getByRole('region', { name: 'Nueva invitación' });
  await creation.getByLabel('Email').fill('  NUEVA@EXAMPLE.TEST ');
  await creation.getByLabel('Rol').selectOption('OWNER');
  await creation.getByRole('button', { name: 'Enviar invitación' }).click();
  await expect(page.getByText('nueva@example.test')).toBeVisible();
  await expect(page.getByText('Invitación creada y enviada.')).toBeVisible();

  await page.getByRole('button', { name: 'Reenviar' }).click();
  await expect(page.getByRole('dialog')).toContainText('enlace anterior');
  await page.getByRole('button', { name: 'Confirmar acción' }).click();
  await expect(page.getByText(/enlace anterior ya no es válido/)).toBeVisible();

  await page.getByRole('button', { name: 'Revocar' }).click();
  await expect(page.getByRole('dialog')).toContainText('ya no podrá utilizar');
  await page.getByRole('button', { name: 'Confirmar acción' }).click();
  await expect(page.getByText('REVOCADA', { exact: true })).toBeVisible();
  await expect(page.getByText(/tokenHash|schemaName/)).toHaveCount(0);
});

test('hides Equipo from EMPLOYEE and preserves a forced 403', async ({ page }) => {
  await installMockApi(page, { role: 'EMPLOYEE' });
  await page.goto('/app/dashboard');
  await expect(page.getByRole('link', { name: 'Equipo' })).toHaveCount(0);

  await page.goto('/app/equipo');
  await expect(page.getByText('No tienes autorización para administrar el equipo')).toBeVisible();
  await expect(page.getByText(/no existe o pertenece/)).toHaveCount(0);

  await page.goto('/app/equipo/invitaciones');
  await expect(
    page.getByText('No tienes autorización para administrar invitaciones'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enviar invitación' })).toHaveCount(0);
});

async function runTransition(page: Page, action: string): Promise<void> {
  await page.getByRole('button', { name: action }).click();
  await page.getByRole('button', { name: 'Confirmar acción' }).click();
}
