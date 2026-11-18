import { Component, inject } from '@angular/core';
import { API_BASE_URL } from '../../../core/config/api-config';

@Component({
  selector: 'app-home-page',
  standalone: true,
  templateUrl: './home-page.component.html',
})
export class HomePageComponent {
  private readonly apiBaseUrl = inject(API_BASE_URL).replace(/\/+$/g, '');
  readonly healthUrl = `${this.apiBaseUrl}/health`;
}
