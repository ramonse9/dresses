import { Component, computed, inject, type OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { BranchesStore } from '../branches/branches.store';
import { normalizeApiError } from '../../core/http/api-error';
import { TenantStore } from '../../core/tenant/tenant.store';
import { ErrorMessageComponent } from '../../shared/ui/error-message/error-message.component';
import { dressMutationErrorMessage } from './dress-error-message';
import { dressFiltersFromParamMap, dressFiltersToQueryParams } from './dress-filters';
import { DressFormComponent } from './dress-form.component';
import type { CreateDressInput, DressFormValue } from './dress.models';
import { DressesStore } from './dresses.store';

@Component({
  selector: 'app-dress-create-page',
  standalone: true,
  imports: [DressFormComponent, ErrorMessageComponent, RouterLink],
  template: `
    <section class="mx-auto max-w-3xl px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <a
        routerLink="/app/vestidos"
        [queryParams]="returnQueryParams"
        class="inline-flex min-h-11 items-center rounded-xl px-3 py-2 text-sm font-semibold text-stone-600 hover:bg-white"
        >Volver al catálogo</a
      >
      <div class="mt-5 rounded-3xl border border-stone-200 bg-white p-7 shadow-sm sm:p-10">
        @if (!isOwner()) {
          <app-error-message error="No tienes autorización para crear vestidos." />
        } @else {
          <p class="text-sm font-semibold uppercase tracking-[0.18em] text-rose-700">Nueva pieza</p>
          <h1 class="mt-2 font-serif text-3xl text-stone-950 sm:text-4xl">Crear vestido</h1>
          <p class="mt-3 text-base leading-7 text-stone-600">
            Registra una pieza física en una sucursal activa.
          </p>
          @if (
            branchesStore.listState().status === 'loading' ||
            branchesStore.listState().status === 'idle'
          ) {
            <p class="mt-8 text-stone-600">Cargando sucursales…</p>
          } @else if (activeBranches().length === 0) {
            <app-error-message
              error="Necesitas al menos una sucursal activa para registrar un vestido."
            />
          } @else {
            <div class="mt-8">
              <app-dress-form
                [branches]="activeBranches()"
                submitLabel="Crear vestido"
                submittingLabel="Creando…"
                [submitting]="submitting()"
                [serverError]="errorMessage()"
                (submitted)="create($event)"
              />
            </div>
          }
        }
      </div>
    </section>
  `,
})
export class DressCreatePageComponent implements OnInit {
  private readonly store = inject(DressesStore);
  readonly branchesStore = inject(BranchesStore);
  private readonly tenantStore = inject(TenantStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly isOwner = computed(() => this.tenantStore.role() === 'OWNER');
  readonly activeBranches = computed(() =>
    this.branchesStore.listState().data.filter(({ activo }) => activo),
  );
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly returnQueryParams = dressFiltersToQueryParams(
    dressFiltersFromParamMap(this.route.snapshot.queryParamMap),
  );

  ngOnInit(): void {
    if (['idle', 'error'].includes(this.branchesStore.listState().status))
      this.branchesStore.loadList().subscribe();
  }

  create(value: DressFormValue): void {
    if (!this.isOwner() || this.submitting()) return;
    const { activo: _activo, ...input } = value;
    this.submitting.set(true);
    this.errorMessage.set(null);
    this.store
      .create(input as CreateDressInput)
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: (dress) =>
          void this.router.navigate(['/app/vestidos', dress.id], {
            queryParams: this.returnQueryParams,
          }),
        error: (error: unknown) =>
          this.errorMessage.set(dressMutationErrorMessage(normalizeApiError(error))),
      });
  }
}
