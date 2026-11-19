import { Component } from '@angular/core';
import { FeaturePlaceholderComponent } from '../../shared/ui/feature-placeholder/feature-placeholder.component';

@Component({
  selector: 'app-dashboard-placeholder',
  standalone: true,
  imports: [FeaturePlaceholderComponent],
  template: `
    <app-feature-placeholder
      eyebrow="Resumen"
      title="Panel de operación"
      description="Consulta aquí la actividad principal de tu boutique cuando los módulos de negocio estén conectados."
    />
  `,
})
export class DashboardPlaceholderComponent {}
