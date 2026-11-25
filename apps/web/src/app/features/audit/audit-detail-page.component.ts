import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, type OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { distinctUntilChanged, map, switchMap } from 'rxjs';
import { ErrorMessageComponent } from '../../shared/ui/error-message/error-message.component';
import { LoadingIndicatorComponent } from '../../shared/ui/loading-indicator/loading-indicator.component';
import { auditErrorMessage } from './audit-error-message';
import { auditFiltersFromParamMap, auditFiltersToQueryParams } from './audit-filters';
import { auditActionLabel, auditMetadataFields, auditResourceLabel } from './audit-metadata';
import { AuditStore } from './audit.store';

@Component({
  selector: 'app-audit-detail-page',
  standalone: true,
  imports: [DatePipe, ErrorMessageComponent, LoadingIndicatorComponent, RouterLink],
  templateUrl: './audit-detail-page.component.html',
})
export class AuditDetailPageComponent implements OnInit {
  readonly store = inject(AuditStore);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  readonly actionLabel = auditActionLabel;
  readonly resourceLabel = auditResourceLabel;
  readonly metadataFields = computed(() => {
    const event = this.store.detailState().data;
    return event ? auditMetadataFields(event) : [];
  });
  readonly errorMessage = computed(() => auditErrorMessage(this.store.detailState().error, true));
  readonly returnQueryParams = auditFiltersToQueryParams(
    auditFiltersFromParamMap(this.route.snapshot.queryParamMap),
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
