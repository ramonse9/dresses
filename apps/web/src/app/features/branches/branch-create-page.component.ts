import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { normalizeApiError } from '../../core/http/api-error';
import { TenantStore } from '../../core/tenant/tenant.store';
import { ErrorMessageComponent } from '../../shared/ui/error-message/error-message.component';
import { branchMutationErrorMessage } from './branch-error-message';
import { BranchFormComponent } from './branch-form.component';
import type { CreateBranchInput } from './branch.models';
import { BranchesStore } from './branches.store';

@Component({
  selector: 'app-branch-create-page',
  standalone: true,
  imports: [BranchFormComponent, ErrorMessageComponent, RouterLink],
  template: `
    <section class="mx-auto max-w-3xl px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <a
        routerLink="/app/sucursales"
        class="inline-flex min-h-11 items-center rounded-xl px-3 py-2 text-sm font-semibold text-stone-600 transition hover:bg-white hover:text-stone-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 focus-visible:ring-offset-2"
      >
        Volver a sucursales
      </a>

      <div class="mt-5 rounded-3xl border border-stone-200 bg-white p-7 shadow-sm sm:p-10">
        @if (isOwner()) {
          <p class="text-sm font-semibold uppercase tracking-[0.18em] text-rose-700">
            Nueva sucursal
          </p>
          <h1 class="mt-2 font-serif text-3xl text-stone-950 sm:text-4xl">Crear sucursal</h1>
          <p class="mt-3 text-base leading-7 text-stone-600">
            Registra un punto de operación para la empresa seleccionada.
          </p>
          <div class="mt-8">
            <app-branch-form
              submitLabel="Crear sucursal"
              submittingLabel="Creando…"
              [submitting]="submitting()"
              [serverError]="errorMessage()"
              (submitted)="create($event)"
            />
          </div>
        } @else {
          <app-error-message error="No tienes autorización para crear sucursales." />
        }
      </div>
    </section>
  `,
})
export class BranchCreatePageComponent {
  private readonly store = inject(BranchesStore);
  private readonly tenantStore = inject(TenantStore);
  private readonly router = inject(Router);
  readonly isOwner = computed(() => this.tenantStore.role() === 'OWNER');
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  create(input: CreateBranchInput): void {
    if (!this.isOwner() || this.submitting()) {
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);
    this.store
      .create(input)
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: (branch) => void this.router.navigate(['/app/sucursales', branch.id]),
        error: (error: unknown) =>
          this.errorMessage.set(branchMutationErrorMessage(normalizeApiError(error))),
      });
  }
}
