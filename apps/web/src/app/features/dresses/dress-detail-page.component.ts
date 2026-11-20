import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { distinctUntilChanged, finalize, map, switchMap } from 'rxjs';
import { normalizeApiError } from '../../core/http/api-error';
import { TenantStore } from '../../core/tenant/tenant.store';
import { ErrorMessageComponent } from '../../shared/ui/error-message/error-message.component';
import { LoadingIndicatorComponent } from '../../shared/ui/loading-indicator/loading-indicator.component';
import { dressErrorMessage, dressMutationErrorMessage } from './dress-error-message';
import { dressFiltersFromParamMap, dressFiltersToQueryParams } from './dress-filters';
import { formatDressMoney } from './dress-money';
import { DressesStore } from './dresses.store';

@Component({
  selector: 'app-dress-detail-page',
  standalone: true,
  imports: [ErrorMessageComponent, LoadingIndicatorComponent, RouterLink],
  templateUrl: './dress-detail-page.component.html',
})
export class DressDetailPageComponent implements OnInit {
  readonly store = inject(DressesStore);
  private readonly route = inject(ActivatedRoute);
  private readonly tenantStore = inject(TenantStore);
  private readonly destroyRef = inject(DestroyRef);
  readonly formatMoney = formatDressMoney;
  readonly errorMessage = computed(() => dressErrorMessage(this.store.detailState().error, true));
  readonly isOwner = computed(() => this.tenantStore.role() === 'OWNER');
  readonly confirmationOpen = signal(false);
  readonly statusSubmitting = signal(false);
  readonly mutationError = signal<string | null>(null);
  readonly returnQueryParams = dressFiltersToQueryParams(
    dressFiltersFromParamMap(this.route.snapshot.queryParamMap),
  );

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        map((params) => params.get('id') ?? ''),
        distinctUntilChanged(),
        switchMap((id) => this.store.loadDetail(id)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  retry(): void {
    this.store.loadDetail(this.route.snapshot.paramMap.get('id') ?? '').subscribe();
  }

  requestDeactivate(): void {
    if (this.isOwner() && !this.statusSubmitting()) this.confirmationOpen.set(true);
  }

  cancelDeactivate(): void {
    this.confirmationOpen.set(false);
  }

  confirmDeactivate(): void {
    const dress = this.store.detailState().data;
    if (!dress || !this.isOwner() || this.statusSubmitting()) return;
    this.confirmationOpen.set(false);
    this.runStatusMutation(this.store.deactivate(dress.id));
  }

  reactivate(): void {
    const dress = this.store.detailState().data;
    if (!dress || !this.isOwner() || this.statusSubmitting()) return;
    this.runStatusMutation(this.store.reactivate(dress.id));
  }

  private runStatusMutation(request: ReturnType<DressesStore['deactivate']>): void {
    this.statusSubmitting.set(true);
    this.mutationError.set(null);
    request.pipe(finalize(() => this.statusSubmitting.set(false))).subscribe({
      error: (error: unknown) =>
        this.mutationError.set(dressMutationErrorMessage(normalizeApiError(error))),
    });
  }
}
