import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <main class="min-h-screen bg-stone-100 text-stone-950">
      <router-outlet />
    </main>
  `,
})
export class AppLayoutComponent {}
