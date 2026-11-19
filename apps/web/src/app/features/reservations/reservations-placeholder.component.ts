import { Component } from '@angular/core';
import { FeaturePlaceholderComponent } from '../../shared/ui/feature-placeholder/feature-placeholder.component';

@Component({
  selector: 'app-reservations-placeholder',
  standalone: true,
  imports: [FeaturePlaceholderComponent],
  template: `
    <app-feature-placeholder
      eyebrow="Rentas"
      title="Reservaciones"
      description="Consulta y da seguimiento al ciclo de vida de las rentas de esta empresa."
    />
  `,
})
export class ReservationsPlaceholderComponent {}
