import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, type OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import { ErrorMessageComponent } from '../../../shared/ui/error-message/error-message.component';
import { LoadingIndicatorComponent } from '../../../shared/ui/loading-indicator/loading-indicator.component';
import type { AccountSession, SessionConfirmation } from './account-session.models';
import { AccountSessionsApiService } from './account-sessions-api.service';
import { CurrentSessionCleanupService } from './current-session-cleanup.service';

type PageStatus = 'loading' | 'loaded' | 'empty' | 'error';

@Component({
  selector: 'app-account-sessions-page',
  standalone: true,
  imports: [DatePipe, EmptyStateComponent, ErrorMessageComponent, LoadingIndicatorComponent],
  templateUrl: './account-sessions-page.component.html',
})
export class AccountSessionsPageComponent implements OnInit {
  private readonly api = inject(AccountSessionsApiService);
  private readonly cleanup = inject(CurrentSessionCleanupService);
  private readonly destroyRef = inject(DestroyRef);
  readonly status = signal<PageStatus>('loading');
  readonly sessions = signal<AccountSession[]>([]);
  readonly error = signal<string | null>(null);
  readonly announcement = signal<string | null>(null);
  readonly confirmation = signal<SessionConfirmation | null>(null);
  readonly submitting = signal(false);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.status.set('loading');
    this.error.set(null);
    this.api
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (sessions) => {
          this.sessions.set(sessions);
          this.status.set(sessions.length === 0 ? 'empty' : 'loaded');
        },
        error: (error: unknown) => this.handleError(error, 'No fue posible cargar tus sesiones.'),
      });
  }

  requestSessionRevocation(session: AccountSession): void {
    if (!this.submitting()) {
      this.error.set(null);
      this.confirmation.set({ kind: 'session', session });
    }
  }

  requestOtherSessionsRevocation(): void {
    if (!this.submitting()) {
      this.error.set(null);
      this.confirmation.set({ kind: 'others' });
    }
  }

  closeConfirmation(): void {
    if (!this.submitting()) {
      this.confirmation.set(null);
    }
  }

  confirmRevocation(): void {
    const confirmation = this.confirmation();
    if (!confirmation || this.submitting()) {
      return;
    }

    this.submitting.set(true);
    this.error.set(null);
    this.announcement.set(null);
    if (confirmation.kind === 'others') {
      this.api
        .revokeOthers()
        .pipe(
          finalize(() => this.submitting.set(false)),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe({
          next: ({ revokedCount }) => {
            this.confirmation.set(null);
            this.announcement.set(`Se revocaron ${revokedCount} sesiones adicionales.`);
            this.load();
          },
          error: (error: unknown) => this.handleRevocationError(error),
        });
      return;
    }

    const session = confirmation.session;
    this.api
      .revoke(session.id)
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.confirmation.set(null);
          if (session.current) {
            this.cleanup.cleanupAndNavigateToLogin();
            return;
          }
          this.announcement.set('La sesión remota fue revocada.');
          this.load();
        },
        error: (error: unknown) => this.handleRevocationError(error),
      });
  }

  sessionStatus(session: AccountSession): string {
    if (session.revokedAt) return 'Revocada';
    return new Date(session.expiresAt).getTime() <= Date.now() ? 'Expirada' : 'Activa';
  }

  confirmationTitle(confirmation: SessionConfirmation): string {
    if (confirmation.kind === 'others') return 'Revocar las demás sesiones';
    return confirmation.session.current ? 'Cerrar esta sesión' : 'Revocar sesión remota';
  }

  confirmationDescription(confirmation: SessionConfirmation): string {
    if (confirmation.kind === 'others') {
      return 'Se cerrarán todas tus otras sesiones. Esta sesión permanecerá activa.';
    }
    if (confirmation.session.current) {
      return 'Esta sesión se cerrará y volverás a la pantalla de inicio de sesión.';
    }
    return 'La sesión seleccionada perderá acceso inmediatamente. Esta sesión seguirá activa.';
  }

  private handleError(error: unknown, fallback: string): void {
    if (error instanceof HttpErrorResponse && error.status === 401) {
      this.cleanup.cleanupAndNavigateToLogin();
      return;
    }
    this.error.set(
      error instanceof HttpErrorResponse && error.status === 404
        ? 'La sesión ya no está disponible o no te pertenece.'
        : fallback,
    );
    this.status.set(this.sessions().length > 0 ? 'loaded' : 'error');
  }

  private handleRevocationError(error: unknown): void {
    this.confirmation.set(null);
    this.handleError(error, 'No fue posible revocar la sesión. Intenta nuevamente.');
  }
}
