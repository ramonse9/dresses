import {
  Component,
  computed,
  DestroyRef,
  effect,
  type ElementRef,
  HostListener,
  inject,
  type OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { distinctUntilChanged, finalize, map, switchMap } from 'rxjs';
import { normalizeApiError } from '../../core/http/api-error';
import { TenantStore } from '../../core/tenant/tenant.store';
import { ErrorMessageComponent } from '../../shared/ui/error-message/error-message.component';
import { LoadingIndicatorComponent } from '../../shared/ui/loading-indicator/loading-indicator.component';
import { customerErrorMessage, customerMutationErrorMessage } from './customer-error-message';
import { customerFiltersFromParamMap, customerFiltersToQueryParams } from './customer-filters';
import { CustomersStore } from './customers.store';

@Component({
  selector: 'app-customer-detail-page',
  standalone: true,
  imports: [ErrorMessageComponent, LoadingIndicatorComponent, RouterLink],
  templateUrl: './customer-detail-page.component.html',
})
export class CustomerDetailPageComponent implements OnInit {
  readonly store = inject(CustomersStore);
  private readonly tenantStore = inject(TenantStore);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly confirmationButton =
    viewChild<ElementRef<HTMLButtonElement>>('confirmationButton');
  private readonly deactivationButton =
    viewChild<ElementRef<HTMLButtonElement>>('deactivationButton');
  private readonly confirmationDialog = viewChild<ElementRef<HTMLElement>>('confirmationDialog');
  readonly errorMessage = computed(() =>
    customerErrorMessage(this.store.detailState().error, true),
  );
  readonly isOwner = computed(() => this.tenantStore.role() === 'OWNER');
  readonly confirmationOpen = signal(false);
  readonly statusSubmitting = signal(false);
  readonly mutationError = signal<string | null>(null);
  readonly returnQueryParams = customerFiltersToQueryParams(
    customerFiltersFromParamMap(this.route.snapshot.queryParamMap),
  );

  constructor() {
    effect(() => {
      if (this.confirmationOpen()) {
        queueMicrotask(() => this.confirmationButton()?.nativeElement.focus());
      }
    });
  }

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

  requestDeactivation(): void {
    if (this.isOwner() && !this.statusSubmitting()) {
      this.mutationError.set(null);
      this.confirmationOpen.set(true);
    }
  }

  cancelDeactivation(): void {
    if (!this.statusSubmitting()) {
      this.confirmationOpen.set(false);
      queueMicrotask(() => this.deactivationButton()?.nativeElement.focus());
    }
  }

  @HostListener('document:keydown.escape')
  closeConfirmationWithEscape(): void {
    if (this.confirmationOpen()) {
      this.cancelDeactivation();
    }
  }

  @HostListener('document:keydown.tab', ['$event'])
  keepFocusInConfirmation(event: Event): void {
    const dialog = this.confirmationDialog()?.nativeElement;
    if (!this.confirmationOpen() || !dialog) {
      return;
    }
    const keyboardEvent = event as KeyboardEvent;
    const buttons = Array.from(
      dialog.querySelectorAll<HTMLButtonElement>('button:not([disabled])'),
    );
    const first = buttons[0];
    const last = buttons.at(-1);
    if (!first || !last) {
      return;
    }
    if (keyboardEvent.shiftKey && document.activeElement === first) {
      keyboardEvent.preventDefault();
      last.focus();
    } else if (!keyboardEvent.shiftKey && document.activeElement === last) {
      keyboardEvent.preventDefault();
      first.focus();
    }
  }

  confirmDeactivation(): void {
    const customer = this.store.detailState().data;
    if (!this.isOwner() || !customer?.activo || this.statusSubmitting()) {
      return;
    }
    this.runStatusMutation(this.store.deactivate(customer.id), true);
  }

  reactivate(): void {
    const customer = this.store.detailState().data;
    if (!this.isOwner() || !customer || customer.activo || this.statusSubmitting()) {
      return;
    }
    this.runStatusMutation(this.store.reactivate(customer.id));
  }

  private runStatusMutation(
    request: ReturnType<CustomersStore['deactivate']>,
    closeDialog = false,
  ): void {
    this.statusSubmitting.set(true);
    this.mutationError.set(null);
    request.pipe(finalize(() => this.statusSubmitting.set(false))).subscribe({
      next: () => {
        if (closeDialog) {
          this.confirmationOpen.set(false);
        }
      },
      error: (error: unknown) => {
        this.confirmationOpen.set(false);
        this.mutationError.set(customerMutationErrorMessage(normalizeApiError(error)));
      },
    });
  }
}
