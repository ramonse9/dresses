import { Component } from '@angular/core';
import { FeaturePlaceholderComponent } from '../../shared/ui/feature-placeholder/feature-placeholder.component';

@Component({
  selector: 'app-customers-placeholder',
  standalone: true,
  imports: [FeaturePlaceholderComponent],
  template: `
    <app-feature-placeholder
      eyebrow="Directorio"
      title="Clientes"
      description="Consulta el directorio de clientes asociado exclusivamente con esta empresa."
    />
  `,
})
export class CustomersPlaceholderComponent {}
