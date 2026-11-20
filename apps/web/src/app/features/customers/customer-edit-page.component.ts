import { Component, computed, inject, type OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { hasAnyRole } from '../../core/auth/role-access';
import { normalizeApiError } from '../../core/http/api-error';
import { TenantStore } from '../../core/tenant/tenant.store';
import { ErrorMessageComponent } from '../../shared/ui/error-message/error-message.component';
import { LoadingIndicatorComponent } from '../../shared/ui/loading-indicator/loading-indicator.component';
import { customerErrorMessage, customerMutationErrorMessage } from './customer-error-message';
import { customerFiltersFromParamMap, customerFiltersToQueryParams } from './customer-filters';
import { CustomerFormComponent } from './customer-form.component';
import type { UpdateCustomerInput } from './customer.models';
import { CustomersStore } from './customers.store';

@Component({
  selector: 'app-customer-edit-page',
  standalone: true,
  imports: [CustomerFormComponent, ErrorMessageComponent, LoadingIndicatorComponent, RouterLink],
  templateUrl: './customer-edit-page.component.html',
})
export class CustomerEditPageComponent implements OnInit {
  readonly store = inject(CustomersStore);
  private readonly tenantStore = inject(TenantStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly canEdit = computed(() => hasAnyRole(this.tenantStore.role(), ['OWNER', 'EMPLOYEE']));
  readonly submitting = signal(false);
  readonly mutationError = signal<string | null>(null);
  readonly loadError = computed(() => customerErrorMessage(this.store.detailState().error, true));
  readonly returnQueryParams = customerFiltersToQueryParams(
    customerFiltersFromParamMap(this.route.snapshot.queryParamMap),
  );

  ngOnInit(): void {
    if (this.canEdit()) {
      this.store.loadDetail(this.customerId).subscribe();
    }
  }

  update(input: UpdateCustomerInput): void {
    if (!this.canEdit() || this.submitting()) {
      return;
    }

    this.submitting.set(true);
    this.mutationError.set(null);
    this.store
      .update(this.customerId, input)
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: (customer) =>
          void this.router.navigate(['/app/clientes', customer.id], {
            queryParams: this.returnQueryParams,
          }),
        error: (error: unknown) =>
          this.mutationError.set(customerMutationErrorMessage(normalizeApiError(error))),
      });
  }

  private get customerId(): string {
    return this.route.snapshot.paramMap.get('id') ?? '';
  }
}
