import { Component } from '@angular/core';
import { FeaturePlaceholderComponent } from '../../shared/ui/feature-placeholder/feature-placeholder.component';

@Component({
  selector: 'app-dresses-placeholder',
  standalone: true,
  imports: [FeaturePlaceholderComponent],
  template: `
    <app-feature-placeholder
      eyebrow="Catálogo"
      title="Vestidos"
      description="Consulta el catálogo de piezas físicas y su estado operativo dentro del tenant actual."
    />
  `,
})
export class DressesPlaceholderComponent {}
