import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { AuthStore } from '../../core/auth/auth.store';
import { TenantStore } from '../../core/tenant/tenant.store';

@Component({
  selector: 'app-account-layout',
  standalone: true,
  imports: [RouterLink, RouterOutlet],
  templateUrl: './account-layout.component.html',
})
export class AccountLayoutComponent {
  readonly authStore = inject(AuthStore);
  private readonly tenantStore = inject(TenantStore);
  readonly returnRoute = computed(() =>
    this.tenantStore.hasSelectedTenant() ? '/app' : '/seleccionar-empresa',
  );
  readonly returnLabel = computed(() =>
    this.tenantStore.hasSelectedTenant() ? 'Volver a la operación' : 'Volver a empresas',
  );
}
