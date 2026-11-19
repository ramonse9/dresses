import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { normalizeApiError } from '../../core/http/api-error';
import { TenantStore } from '../../core/tenant/tenant.store';
import { ErrorMessageComponent } from '../../shared/ui/error-message/error-message.component';
import { LoadingIndicatorComponent } from '../../shared/ui/loading-indicator/loading-indicator.component';
import { branchErrorMessage, branchMutationErrorMessage } from './branch-error-message';
import { BranchFormComponent } from './branch-form.component';
import type { UpdateBranchInput } from './branch.models';
import { BranchesStore } from './branches.store';

@Component({
  selector: 'app-branch-edit-page',
  standalone: true,
  imports: [BranchFormComponent, ErrorMessageComponent, LoadingIndicatorComponent, RouterLink],
  templateUrl: './branch-edit-page.component.html',
})
export class BranchEditPageComponent implements OnInit {
  readonly store = inject(BranchesStore);
  private readonly tenantStore = inject(TenantStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly isOwner = computed(() => this.tenantStore.role() === 'OWNER');
  readonly submitting = signal(false);
  readonly mutationError = signal<string | null>(null);
  readonly loadError = computed(() => branchErrorMessage(this.store.detailState().error, true));

  ngOnInit(): void {
    if (this.isOwner()) {
      this.store.loadDetail(this.branchId).subscribe();
    }
  }

  update(input: UpdateBranchInput): void {
    if (!this.isOwner() || this.submitting()) {
      return;
    }

    this.submitting.set(true);
    this.mutationError.set(null);
    this.store
      .update(this.branchId, input)
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: (branch) => void this.router.navigate(['/app/sucursales', branch.id]),
        error: (error: unknown) =>
          this.mutationError.set(branchMutationErrorMessage(normalizeApiError(error))),
      });
  }

  private get branchId(): string {
    return this.route.snapshot.paramMap.get('id') ?? '';
  }
}
