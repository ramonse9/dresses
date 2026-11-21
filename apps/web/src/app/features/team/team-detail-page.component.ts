import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, type OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { distinctUntilChanged, finalize, map, switchMap, tap } from 'rxjs';
import { AuthStore } from '../../core/auth/auth.store';
import { normalizeApiError } from '../../core/http/api-error';
import type { EmpresaRole } from '../../core/tenant/tenant.models';
import { TenantStore } from '../../core/tenant/tenant.store';
import { ErrorMessageComponent } from '../../shared/ui/error-message/error-message.component';
import { LoadingIndicatorComponent } from '../../shared/ui/loading-indicator/loading-indicator.component';
import { teamErrorMessage, teamMutationErrorMessage } from './team-error-message';
import { teamFiltersFromParamMap, teamFiltersToQueryParams } from './team-filters';
import { TeamStore } from './team.store';

type PendingAction =
  | { readonly kind: 'role'; readonly role: EmpresaRole }
  | { readonly kind: 'status'; readonly active: boolean };

@Component({
  selector: 'app-team-detail-page',
  standalone: true,
  imports: [
    DatePipe,
    ErrorMessageComponent,
    LoadingIndicatorComponent,
    ReactiveFormsModule,
    RouterLink,
  ],
  templateUrl: './team-detail-page.component.html',
})
export class TeamDetailPageComponent implements OnInit {
  readonly store = inject(TeamStore);
  private readonly authStore = inject(AuthStore);
  private readonly tenantStore = inject(TenantStore);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  readonly roleControl = new FormControl<EmpresaRole>('EMPLOYEE', { nonNullable: true });
  readonly submitting = signal(false);
  readonly pendingAction = signal<PendingAction | null>(null);
  readonly mutationError = signal<string | null>(null);
  readonly errorMessage = computed(() => teamErrorMessage(this.store.detailState().error, true));
  readonly isOwner = computed(() => this.tenantStore.role() === 'OWNER');
  readonly isCurrentUser = computed(
    () => this.store.detailState().data?.usuario.id === this.authStore.user()?.sub,
  );
  readonly returnQueryParams = teamFiltersToQueryParams(
    teamFiltersFromParamMap(this.route.snapshot.queryParamMap),
  );
  readonly confirmationTitle = computed(() => {
    const action = this.pendingAction();
    if (action?.kind === 'status') return 'Desactivar membresía';
    return this.isCurrentUser() ? 'Modificar tu propia membresía' : 'Degradar propietario';
  });

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        map((params) => params.get('id') ?? ''),
        distinctUntilChanged(),
        switchMap((id) => this.store.loadDetail(id)),
        tap(() => {
          const member = this.store.detailState().data;
          if (member) this.roleControl.setValue(member.rol, { emitEvent: false });
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  retry(): void {
    this.store.loadDetail(this.route.snapshot.paramMap.get('id') ?? '').subscribe();
  }

  requestRoleChange(): void {
    const member = this.store.detailState().data;
    const role = this.roleControl.value;
    if (!this.isOwner() || !member || role === member.rol || this.submitting()) return;
    if ((member.rol === 'OWNER' && role === 'EMPLOYEE') || this.isCurrentUser()) {
      this.pendingAction.set({ kind: 'role', role });
      return;
    }
    this.runRoleChange(role);
  }

  requestStatusChange(): void {
    const member = this.store.detailState().data;
    if (!this.isOwner() || !member || this.submitting()) return;
    if (member.activo || this.isCurrentUser()) {
      this.pendingAction.set({ kind: 'status', active: !member.activo });
      return;
    }
    this.runStatusChange(true);
  }

  cancelConfirmation(): void {
    if (!this.submitting()) this.pendingAction.set(null);
  }

  confirmAction(): void {
    const action = this.pendingAction();
    if (!action || this.submitting()) return;
    if (action.kind === 'role') this.runRoleChange(action.role);
    else this.runStatusChange(action.active);
  }

  private runRoleChange(role: EmpresaRole): void {
    const member = this.store.detailState().data;
    if (!member) return;
    this.runMutation(this.store.changeRole(member.id, role));
  }

  private runStatusChange(active: boolean): void {
    const member = this.store.detailState().data;
    if (!member) return;
    this.runMutation(this.store.changeStatus(member.id, active));
  }

  private runMutation(request: ReturnType<TeamStore['changeRole']>): void {
    this.submitting.set(true);
    this.mutationError.set(null);
    request.pipe(finalize(() => this.submitting.set(false))).subscribe({
      next: (member) => {
        this.pendingAction.set(null);
        this.roleControl.setValue(member.rol, { emitEvent: false });
      },
      error: (error: unknown) => {
        this.pendingAction.set(null);
        const member = this.store.detailState().data;
        if (member) this.roleControl.setValue(member.rol, { emitEvent: false });
        this.mutationError.set(teamMutationErrorMessage(normalizeApiError(error)));
      },
    });
  }
}
