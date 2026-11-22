import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, type OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { debounceTime, distinctUntilChanged, finalize, map, switchMap, tap } from 'rxjs';
import { normalizeApiError } from '../../core/http/api-error';
import type { EmpresaRole } from '../../core/tenant/tenant.models';
import { TenantStore } from '../../core/tenant/tenant.store';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { ErrorMessageComponent } from '../../shared/ui/error-message/error-message.component';
import { LoadingIndicatorComponent } from '../../shared/ui/loading-indicator/loading-indicator.component';
import { SubmitButtonComponent } from '../../shared/ui/submit-button/submit-button.component';
import {
  invitationListErrorMessage,
  invitationMutationErrorMessage,
} from './team-invitation-error-message';
import {
  invitationFiltersFromParamMap,
  MAXIMUM_INVITATION_SEARCH_LENGTH,
  normalizeInvitationSearch,
} from './team-invitation-filters';
import type {
  TeamInvitation,
  TeamInvitationFilters,
  TeamInvitationState,
} from './team-invitation.models';
import { TeamInvitationsStore } from './team-invitations.store';

type RoleFilter = 'all' | 'OWNER' | 'EMPLOYEE';
type StateFilter = 'all' | TeamInvitationState;
type PendingAction = {
  readonly kind: 'resend' | 'revoke';
  readonly invitation: TeamInvitation;
};

@Component({
  selector: 'app-team-invitations-page',
  standalone: true,
  imports: [
    DatePipe,
    EmptyStateComponent,
    ErrorMessageComponent,
    LoadingIndicatorComponent,
    ReactiveFormsModule,
    RouterLink,
    RouterLinkActive,
    SubmitButtonComponent,
  ],
  templateUrl: './team-invitations-page.component.html',
})
export class TeamInvitationsPageComponent implements OnInit {
  readonly store = inject(TeamInvitationsStore);
  private readonly tenantStore = inject(TenantStore);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly isOwner = computed(() => this.tenantStore.role() === 'OWNER');
  readonly pageSizes = [10, 20, 50, 100] as const;
  readonly maximumSearchLength = MAXIMUM_INVITATION_SEARCH_LENGTH;
  readonly createSubmitting = signal(false);
  readonly actionSubmitting = signal(false);
  readonly pendingAction = signal<PendingAction | null>(null);
  readonly mutationError = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly listError = computed(() => invitationListErrorMessage(this.store.state().error));
  readonly hasFilters = computed(() => {
    const filters = this.store.state().filters;
    return filters.estado !== undefined || filters.rol !== undefined || filters.q !== undefined;
  });
  readonly createForm = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    rol: this.formBuilder.nonNullable.control<EmpresaRole>('EMPLOYEE', Validators.required),
  });
  readonly filtersForm = this.formBuilder.nonNullable.group({
    q: '',
    estado: 'all' as StateFilter,
    rol: 'all' as RoleFilter,
    limit: 20,
  });

  ngOnInit(): void {
    this.filtersForm.controls.q.valueChanges
      .pipe(
        map(normalizeInvitationSearch),
        debounceTime(350),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((q) => this.updateQuery({ q: q || null, page: 1 }));
    this.filtersForm.controls.estado.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((estado) =>
        this.updateQuery({ estado: estado === 'all' ? null : estado, page: 1 }),
      );
    this.filtersForm.controls.rol.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((rol) => this.updateQuery({ rol: rol === 'all' ? null : rol, page: 1 }));
    this.filtersForm.controls.limit.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((limit) => this.updateQuery({ limit, page: 1 }));

    this.route.queryParamMap
      .pipe(
        map(invitationFiltersFromParamMap),
        distinctUntilChanged(filtersEqual),
        tap((filters) => this.syncFilters(filters)),
        switchMap((filters) => this.store.load(filters)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  createInvitation(): void {
    if (!this.isOwner() || this.createSubmitting()) return;
    const email = this.createForm.controls.email.value.trim().toLowerCase();
    this.createForm.controls.email.setValue(email, { emitEvent: false });
    this.createForm.markAllAsTouched();
    if (this.createForm.invalid) return;

    const value = this.createForm.getRawValue();
    this.createSubmitting.set(true);
    this.mutationError.set(null);
    this.successMessage.set(null);
    this.store
      .create({ email, rol: value.rol })
      .pipe(finalize(() => this.createSubmitting.set(false)))
      .subscribe({
        next: () => {
          this.createForm.reset({ email: '', rol: 'EMPLOYEE' });
          this.successMessage.set('Invitación creada y enviada.');
        },
        error: (error: unknown) => {
          const normalized = normalizeApiError(error);
          this.mutationError.set(invitationMutationErrorMessage(normalized));
          if (normalized.status === 503) {
            this.store.load(this.store.state().filters).subscribe();
          }
        },
      });
  }

  requestResend(invitation: TeamInvitation): void {
    if (!this.isOwner() || invitation.estado !== 'PENDIENTE' || this.actionSubmitting()) return;
    this.pendingAction.set({ kind: 'resend', invitation });
  }

  requestRevoke(invitation: TeamInvitation): void {
    if (
      !this.isOwner() ||
      !['PENDIENTE', 'EXPIRADA'].includes(invitation.estado) ||
      this.actionSubmitting()
    )
      return;
    this.pendingAction.set({ kind: 'revoke', invitation });
  }

  cancelConfirmation(): void {
    if (!this.actionSubmitting()) this.pendingAction.set(null);
  }

  confirmAction(): void {
    const action = this.pendingAction();
    if (!action || this.actionSubmitting()) return;
    this.actionSubmitting.set(true);
    this.mutationError.set(null);
    this.successMessage.set(null);
    const request =
      action.kind === 'resend'
        ? this.store.resend(action.invitation.id)
        : this.store.revoke(action.invitation.id);
    request.pipe(finalize(() => this.actionSubmitting.set(false))).subscribe({
      next: () => {
        this.pendingAction.set(null);
        this.successMessage.set(
          action.kind === 'resend'
            ? 'Invitación reenviada. El enlace anterior ya no es válido.'
            : 'Invitación revocada.',
        );
      },
      error: (error: unknown) => {
        this.pendingAction.set(null);
        this.mutationError.set(invitationMutationErrorMessage(normalizeApiError(error)));
      },
    });
  }

  goToPage(page: number): void {
    const pagination = this.store.state().pagination;
    if (page < 1 || page > pagination.totalPages || page === pagination.page) return;
    this.updateQuery({ page });
  }

  clearFilters(): void {
    this.updateQuery({ q: null, estado: null, rol: null, page: 1 });
  }

  retry(): void {
    this.store.load(this.store.state().filters).subscribe();
  }

  private syncFilters(filters: TeamInvitationFilters): void {
    this.filtersForm.setValue(
      {
        q: filters.q ?? '',
        estado: filters.estado ?? 'all',
        rol: filters.rol ?? 'all',
        limit: filters.limit,
      },
      { emitEvent: false },
    );
  }

  private updateQuery(queryParams: Record<string, string | number | null>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }
}

function filtersEqual(first: TeamInvitationFilters, second: TeamInvitationFilters): boolean {
  return (
    first.page === second.page &&
    first.limit === second.limit &&
    first.estado === second.estado &&
    first.rol === second.rol &&
    first.q === second.q
  );
}
