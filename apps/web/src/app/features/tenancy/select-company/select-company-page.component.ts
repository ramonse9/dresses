import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthLogoutService } from '../../../core/auth/auth-logout.service';
import { TenantStore } from '../../../core/tenant/tenant.store';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import { ErrorMessageComponent } from '../../../shared/ui/error-message/error-message.component';
import { LoadingIndicatorComponent } from '../../../shared/ui/loading-indicator/loading-indicator.component';

@Component({
  selector: 'app-select-company-page',
  standalone: true,
  imports: [EmptyStateComponent, ErrorMessageComponent, LoadingIndicatorComponent],
  templateUrl: './select-company-page.component.html',
})
export class SelectCompanyPageComponent implements OnInit {
  readonly tenantStore = inject(TenantStore);
  private readonly authLogout = inject(AuthLogoutService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly loggingOut = signal(false);
  readonly selectionError = signal<string | null>(null);
  readonly changingCompany = this.route.snapshot.queryParamMap.get('change') === 'true';

  ngOnInit(): void {
    const initialization = this.changingCompany
      ? this.tenantStore.reloadCompanies()
      : this.tenantStore.initialize();
    initialization.subscribe(() => this.navigateWhenSelected());
  }

  selectCompany(empresaId: string): void {
    if (this.tenantStore.loading()) {
      return;
    }

    this.selectionError.set(null);
    this.tenantStore.selectCompany(empresaId).subscribe({
      next: () => void this.router.navigateByUrl('/app'),
      error: (error: unknown) => {
        this.selectionError.set(
          error instanceof HttpErrorResponse && [401, 403, 404].includes(error.status)
            ? 'Ya no tienes acceso a esa empresa. Elige otra opción disponible.'
            : 'No fue posible seleccionar la empresa. Intenta nuevamente.',
        );
      },
    });
  }

  retry(): void {
    this.selectionError.set(null);
    this.tenantStore.reloadCompanies().subscribe(() => this.navigateWhenSelected());
  }

  logout(): void {
    if (this.loggingOut()) {
      return;
    }

    this.loggingOut.set(true);
    this.authLogout
      .logout()
      .pipe(finalize(() => this.loggingOut.set(false)))
      .subscribe();
  }

  private navigateWhenSelected(): void {
    if (this.tenantStore.hasSelectedTenant() && !this.changingCompany) {
      void this.router.navigateByUrl('/app');
    }
  }
}
