import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { BranchesStore } from '../branches/branches.store';
import { normalizeApiError } from '../../core/http/api-error';
import { TenantStore } from '../../core/tenant/tenant.store';
import { ErrorMessageComponent } from '../../shared/ui/error-message/error-message.component';
import { LoadingIndicatorComponent } from '../../shared/ui/loading-indicator/loading-indicator.component';
import { dressErrorMessage, dressMutationErrorMessage } from './dress-error-message';
import { dressFiltersFromParamMap, dressFiltersToQueryParams } from './dress-filters';
import { DressFormComponent } from './dress-form.component';
import type { DressFormValue } from './dress.models';
import { DressesStore } from './dresses.store';

@Component({
  selector: 'app-dress-edit-page',
  standalone: true,
  imports: [DressFormComponent, ErrorMessageComponent, LoadingIndicatorComponent, RouterLink],
  template: `
    <section class="mx-auto max-w-3xl px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <a
        [routerLink]="['/app/vestidos', dressId]"
        [queryParams]="returnQueryParams"
        class="inline-flex min-h-11 items-center rounded-xl px-3 py-2 text-sm font-semibold text-stone-600 hover:bg-white"
        >Volver al detalle</a
      >
      <div class="mt-5 rounded-3xl border border-stone-200 bg-white p-7 shadow-sm sm:p-10">
        @if (!isOwner()) {
          <app-error-message error="No tienes autorización para editar vestidos." />
        } @else if (
          store.detailState().status === 'loading' || store.detailState().status === 'idle'
        ) {
          <app-loading-indicator label="Cargando vestido…" />
        } @else if (store.detailState().status === 'error') {
          <app-error-message [error]="loadError()" />
        } @else if (store.detailState().data; as dress) {
          <p class="text-sm font-semibold uppercase tracking-[0.18em] text-rose-700">Edición</p>
          <h1 class="mt-2 font-serif text-3xl text-stone-950 sm:text-4xl">Editar vestido</h1>
          <p class="mt-3 text-base leading-7 text-stone-600">
            Un cambio de sucursal se confirmará como traslado de la pieza.
          </p>
          <div class="mt-8">
            <app-dress-form
              [initialValue]="dress"
              [branches]="activeBranches()"
              [showActive]="true"
              submitLabel="Guardar cambios"
              [submitting]="submitting()"
              [serverError]="errorMessage()"
              (submitted)="requestUpdate($event)"
            />
          </div>
        }
      </div>
    </section>
    @if (pendingUpdate(); as update) {
      <div
        class="fixed inset-0 z-50 grid place-items-center bg-stone-950/60 p-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="transfer-title"
      >
        <div class="w-full max-w-lg rounded-3xl bg-white p-7 shadow-2xl">
          <p class="text-sm font-semibold uppercase tracking-[0.18em] text-rose-700">
            Confirmar traslado
          </p>
          <h2 id="transfer-title" class="mt-2 font-serif text-2xl text-stone-950">
            ¿Trasladar este vestido?
          </h2>
          <p class="mt-4 leading-7 text-stone-600">
            La pieza cambiará de <strong>{{ store.detailState().data?.sucursal?.nombre }}</strong> a
            <strong>{{ destinationName(update.sucursalId) }}</strong
            >.
          </p>
          <div class="mt-7 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              class="min-h-11 rounded-full border border-stone-300 px-5 font-semibold"
              (click)="cancelTransfer()"
            >
              Cancelar</button
            ><button
              type="button"
              class="min-h-11 rounded-full bg-stone-950 px-5 font-semibold text-white"
              (click)="confirmTransfer()"
            >
              Confirmar traslado
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class DressEditPageComponent implements OnInit {
  readonly store = inject(DressesStore);
  readonly branchesStore = inject(BranchesStore);
  private readonly tenantStore = inject(TenantStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly dressId = this.route.snapshot.paramMap.get('id') ?? '';
  readonly isOwner = computed(() => this.tenantStore.role() === 'OWNER');
  readonly activeBranches = computed(() =>
    this.branchesStore.listState().data.filter(({ activo }) => activo),
  );
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly pendingUpdate = signal<DressFormValue | null>(null);
  readonly loadError = computed(() => dressErrorMessage(this.store.detailState().error, true));
  readonly returnQueryParams = dressFiltersToQueryParams(
    dressFiltersFromParamMap(this.route.snapshot.queryParamMap),
  );

  ngOnInit(): void {
    if (!this.isOwner()) return;
    if (['idle', 'error'].includes(this.branchesStore.listState().status))
      this.branchesStore.loadList().subscribe();
    this.store.loadDetail(this.dressId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }

  requestUpdate(value: DressFormValue): void {
    if (value.sucursalId !== this.store.detailState().data?.sucursalId)
      this.pendingUpdate.set(value);
    else this.save(value);
  }
  confirmTransfer(): void {
    const value = this.pendingUpdate();
    this.pendingUpdate.set(null);
    if (value) this.save(value);
  }
  cancelTransfer(): void {
    this.pendingUpdate.set(null);
  }
  destinationName(id: string): string {
    return (
      this.activeBranches().find((branch) => branch.id === id)?.nombre ?? 'la sucursal seleccionada'
    );
  }

  private save(value: DressFormValue): void {
    if (!this.isOwner() || this.submitting()) return;
    this.submitting.set(true);
    this.errorMessage.set(null);
    this.store
      .update(this.dressId, value)
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () =>
          void this.router.navigate(['/app/vestidos', this.dressId], {
            queryParams: this.returnQueryParams,
          }),
        error: (error: unknown) =>
          this.errorMessage.set(dressMutationErrorMessage(normalizeApiError(error))),
      });
  }
}
