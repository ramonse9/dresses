import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { hasAnyRole } from '../../core/auth/role-access';
import { normalizeApiError } from '../../core/http/api-error';
import { TenantStore } from '../../core/tenant/tenant.store';
import { ErrorMessageComponent } from '../../shared/ui/error-message/error-message.component';
import { customerMutationErrorMessage } from './customer-error-message';
import { customerFiltersFromParamMap, customerFiltersToQueryParams } from './customer-filters';
import { CustomerFormComponent } from './customer-form.component';
import type { CreateCustomerInput } from './customer.models';
import { CustomersStore } from './customers.store';

@Component({
  selector: 'app-customer-create-page',
  standalone: true,
  imports: [CustomerFormComponent, ErrorMessageComponent, RouterLink],
  template: `
    <section class="mx-auto max-w-3xl px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <a
        routerLink="/app/clientes"
        [queryParams]="returnQueryParams"
        class="inline-flex min-h-11 items-center rounded-xl px-3 py-2 text-sm font-semibold text-stone-600 transition hover:bg-white hover:text-stone-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 focus-visible:ring-offset-2"
      >
        Volver a clientes
      </a>

      <div class="mt-5 rounded-3xl border border-stone-200 bg-white p-7 shadow-sm sm:p-10">
        @if (canEdit()) {
          <p class="text-sm font-semibold uppercase tracking-[0.18em] text-rose-700">
            Nuevo cliente
          </p>
          <h1 class="mt-2 font-serif text-3xl text-stone-950 sm:text-4xl">Crear cliente</h1>
          <p class="mt-3 text-base leading-7 text-stone-600">
            Registra sus datos básicos. Se requiere al menos un teléfono o un email.
          </p>
          <div class="mt-8">
            <app-customer-form
              submitLabel="Crear cliente"
              submittingLabel="Creando…"
              [submitting]="submitting()"
              [serverError]="errorMessage()"
              (submitted)="create($event)"
            />
          </div>
        } @else {
          <app-error-message error="No tienes autorización para crear clientes." />
        }
      </div>
    </section>
  `,
})
export class CustomerCreatePageComponent {
  private readonly store = inject(CustomersStore);
  private readonly tenantStore = inject(TenantStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly canEdit = computed(() => hasAnyRole(this.tenantStore.role(), ['OWNER', 'EMPLOYEE']));
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly returnQueryParams = customerFiltersToQueryParams(
    customerFiltersFromParamMap(this.route.snapshot.queryParamMap),
  );

  create(input: CreateCustomerInput): void {
    if (!this.canEdit() || this.submitting()) {
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);
    this.store
      .create(input)
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: (customer) =>
          void this.router.navigate(['/app/clientes', customer.id], {
            queryParams: this.returnQueryParams,
          }),
        error: (error: unknown) =>
          this.errorMessage.set(customerMutationErrorMessage(normalizeApiError(error))),
      });
  }
}
