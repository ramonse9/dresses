import {
  Component,
  computed,
  effect,
  type ElementRef,
  HostListener,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthLogoutService } from '../../core/auth/auth-logout.service';
import { AuthStore } from '../../core/auth/auth.store';
import { navigationForRole } from '../../core/navigation/app-navigation';
import { TenantStore } from '../../core/tenant/tenant.store';
import { AppNavigationComponent } from './app-navigation.component';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [AppNavigationComponent, RouterLink, RouterOutlet],
  templateUrl: './app-layout.component.html',
})
export class AppLayoutComponent {
  readonly authStore = inject(AuthStore);
  readonly tenantStore = inject(TenantStore);
  private readonly authLogout = inject(AuthLogoutService);
  private readonly mobileMenuButton = viewChild<ElementRef<HTMLButtonElement>>('mobileMenuButton');
  private readonly mobileCloseButton =
    viewChild<ElementRef<HTMLButtonElement>>('mobileCloseButton');
  private readonly mobilePanel = viewChild<ElementRef<HTMLElement>>('mobilePanel');
  readonly loggingOut = signal(false);
  readonly mobileMenuOpen = signal(false);
  readonly navigationItems = computed(() => navigationForRole(this.tenantStore.role()));
  readonly roleLabel = computed(() => {
    const role = this.tenantStore.role();
    return role === 'OWNER' ? 'Propietario' : role === 'EMPLOYEE' ? 'Empleado' : 'Sin rol vigente';
  });
  readonly accessIssue = computed(() => {
    if (!this.authStore.isAuthenticated()) {
      return {
        message: 'Tu sesión expiró. Inicia sesión nuevamente para continuar.',
        action: 'Iniciar sesión',
        route: '/login',
      };
    }
    if (!this.tenantStore.hasSelectedTenant()) {
      return {
        message: 'Tu acceso a la empresa expiró o dejó de estar disponible.',
        action: 'Seleccionar empresa',
        route: '/seleccionar-empresa',
      };
    }
    return null;
  });

  constructor() {
    effect(() => {
      if (this.mobileMenuOpen()) {
        queueMicrotask(() => this.mobileCloseButton()?.nativeElement.focus());
      }
    });
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update((open) => !open);
  }

  closeMobileMenu(restoreFocus = false): void {
    if (!this.mobileMenuOpen()) {
      return;
    }
    this.mobileMenuOpen.set(false);
    if (restoreFocus) {
      queueMicrotask(() => this.mobileMenuButton()?.nativeElement.focus());
    }
  }

  @HostListener('document:keydown.escape')
  closeMobileMenuWithEscape(): void {
    this.closeMobileMenu(true);
  }

  @HostListener('document:keydown.tab', ['$event'])
  keepFocusInMobileMenu(event: Event): void {
    const panel = this.mobilePanel()?.nativeElement;
    if (!this.mobileMenuOpen() || !panel) {
      return;
    }
    const keyboardEvent = event as KeyboardEvent;

    const focusable = Array.from(
      panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => !element.hasAttribute('hidden'));
    const first = focusable[0];
    const last = focusable.at(-1);
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

  logout(): void {
    if (this.loggingOut()) {
      return;
    }

    this.loggingOut.set(true);
    this.authLogout
      .logout()
      .pipe(finalize(() => this.loggingOut.set(false)))
      .subscribe();
  }
}
