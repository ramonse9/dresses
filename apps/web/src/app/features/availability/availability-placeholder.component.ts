import { Component } from '@angular/core';
import { FeaturePlaceholderComponent } from '../../shared/ui/feature-placeholder/feature-placeholder.component';

@Component({
  selector: 'app-availability-placeholder',
  standalone: true,
  imports: [FeaturePlaceholderComponent],
  template: `
    <app-feature-placeholder
      eyebrow="Calendario"
      title="Disponibilidad"
      description="Consulta qué piezas están disponibles por sucursal y rango de fechas."
    />
  `,
})
export class AvailabilityPlaceholderComponent {}
