import { Component, computed, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { distinctUntilChanged, map, switchMap } from 'rxjs';
import { ErrorMessageComponent } from '../../shared/ui/error-message/error-message.component';
import { LoadingIndicatorComponent } from '../../shared/ui/loading-indicator/loading-indicator.component';
import { dressErrorMessage } from './dress-error-message';
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
  private readonly destroyRef = inject(DestroyRef);
  readonly formatMoney = formatDressMoney;
  readonly errorMessage = computed(() => dressErrorMessage(this.store.detailState().error, true));
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
}
