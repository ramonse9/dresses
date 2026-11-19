import { Component, computed, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { ErrorMessageComponent } from '../../shared/ui/error-message/error-message.component';
import { LoadingIndicatorComponent } from '../../shared/ui/loading-indicator/loading-indicator.component';
import { branchErrorMessage } from './branch-error-message';
import { BranchesStore } from './branches.store';

@Component({
  selector: 'app-branches-list-page',
  standalone: true,
  imports: [EmptyStateComponent, ErrorMessageComponent, LoadingIndicatorComponent, RouterLink],
  templateUrl: './branches-list-page.component.html',
})
export class BranchesListPageComponent implements OnInit {
  readonly store = inject(BranchesStore);
  readonly errorMessage = computed(() => branchErrorMessage(this.store.listState().error));

  ngOnInit(): void {
    this.store.loadList().subscribe();
  }

  retry(): void {
    this.store.loadList().subscribe();
  }
}
