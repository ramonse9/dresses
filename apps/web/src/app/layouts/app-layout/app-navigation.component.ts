import { Component, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import type { AppNavigationItem } from '../../core/navigation/app-navigation';

@Component({
  selector: 'app-navigation',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav [attr.aria-label]="ariaLabel()">
      <ul class="space-y-1">
        @for (item of items(); track item.route) {
          <li>
            <a
              [routerLink]="item.route"
              routerLinkActive="bg-rose-50 text-rose-800"
              #activeLink="routerLinkActive"
              [attr.aria-current]="activeLink.isActive ? 'page' : null"
              class="group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-stone-600 transition hover:bg-stone-100 hover:text-stone-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 focus-visible:ring-offset-2"
              (click)="navigated.emit()"
            >
              <span class="grid size-6 place-items-center" aria-hidden="true">
                @switch (item.icon) {
                  @case ('dashboard') {
                    <svg class="size-5" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M4 4h6v6H4V4Zm10 0h6v10h-6V4ZM4 14h6v6H4v-6Zm10 4h6v2h-6v-2Z"
                        stroke="currentColor"
                        stroke-width="1.6"
                        stroke-linejoin="round"
                      />
                    </svg>
                  }
                  @case ('branches') {
                    <svg class="size-5" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M4 20h16M6 20V8l6-4 6 4v12M9 11h2m2 0h2m-6 4h2m2 0h2"
                        stroke="currentColor"
                        stroke-width="1.6"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                    </svg>
                  }
                  @case ('customers') {
                    <svg class="size-5" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M16 20v-1.5A3.5 3.5 0 0 0 12.5 15h-5A3.5 3.5 0 0 0 4 18.5V20m5.5-8a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm6-1.5a3.5 3.5 0 0 1 4.5 3.35V20"
                        stroke="currentColor"
                        stroke-width="1.6"
                        stroke-linecap="round"
                      />
                    </svg>
                  }
                  @case ('dresses') {
                    <svg class="size-5" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M9 4.75 12 3l3 1.75M12 3v4m-5.5 1.5L12 7l5.5 1.5-2 11h-7l-2-11Z"
                        stroke="currentColor"
                        stroke-width="1.6"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                    </svg>
                  }
                  @case ('availability') {
                    <svg class="size-5" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M7 3v3m10-3v3M4 9h16M6 5h12a2 2 0 0 1 2 2v13H4V7a2 2 0 0 1 2-2Zm3 9 2 2 4-4"
                        stroke="currentColor"
                        stroke-width="1.6"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                    </svg>
                  }
                  @case ('reservations') {
                    <svg class="size-5" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M7 3v3m10-3v3M4 9h16M6 5h12a2 2 0 0 1 2 2v13H4V7a2 2 0 0 1 2-2Zm3 8h6m-6 3h4"
                        stroke="currentColor"
                        stroke-width="1.6"
                        stroke-linecap="round"
                      />
                    </svg>
                  }
                }
              </span>
              <span>{{ item.label }}</span>
            </a>
          </li>
        }
      </ul>
    </nav>
  `,
})
export class AppNavigationComponent {
  readonly items = input.required<readonly AppNavigationItem[]>();
  readonly ariaLabel = input('Navegación principal');
  readonly navigated = output<void>();
}
