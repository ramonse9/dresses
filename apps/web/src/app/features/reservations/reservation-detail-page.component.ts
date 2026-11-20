import { Component, computed, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { distinctUntilChanged, map, switchMap } from 'rxjs';
import { formatDressMoney } from '../dresses/dress-money';
import { ErrorMessageComponent } from '../../shared/ui/error-message/error-message.component';
import { LoadingIndicatorComponent } from '../../shared/ui/loading-indicator/loading-indicator.component';
import { formatReservationDate, reservationStatusLabel } from './reservation-display';
import { reservationErrorMessage } from './reservation-error-message';
import {
  reservationFiltersFromParamMap,
  reservationFiltersToQueryParams,
} from './reservation-filters';
import { ReservationsStore } from './reservations.store';

@Component({
  selector: 'app-reservation-detail-page',
  standalone: true,
  imports: [ErrorMessageComponent, LoadingIndicatorComponent, RouterLink],
  templateUrl: './reservation-detail-page.component.html',
})
export class ReservationDetailPageComponent implements OnInit {
  readonly store = inject(ReservationsStore);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  readonly formatDate = formatReservationDate;
  readonly formatMoney = formatDressMoney;
  readonly statusLabel = reservationStatusLabel;
  readonly errorMessage = computed(() =>
    reservationErrorMessage(this.store.detailState().error, true),
  );
  readonly returnQueryParams = reservationFiltersToQueryParams(
    reservationFiltersFromParamMap(this.route.snapshot.queryParamMap),
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
