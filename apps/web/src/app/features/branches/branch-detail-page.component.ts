import { Component, computed, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { distinctUntilChanged, map, switchMap } from 'rxjs';
import { ErrorMessageComponent } from '../../shared/ui/error-message/error-message.component';
import { LoadingIndicatorComponent } from '../../shared/ui/loading-indicator/loading-indicator.component';
import { branchErrorMessage } from './branch-error-message';
import { BranchesStore } from './branches.store';

@Component({
  selector: 'app-branch-detail-page',
  standalone: true,
  imports: [ErrorMessageComponent, LoadingIndicatorComponent, RouterLink],
  templateUrl: './branch-detail-page.component.html',
})
export class BranchDetailPageComponent implements OnInit {
  readonly store = inject(BranchesStore);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  readonly errorMessage = computed(() => branchErrorMessage(this.store.detailState().error, true));

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
