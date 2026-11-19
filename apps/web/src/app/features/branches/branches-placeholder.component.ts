import { Component } from '@angular/core';
import { FeaturePlaceholderComponent } from '../../shared/ui/feature-placeholder/feature-placeholder.component';

@Component({
  selector: 'app-branches-placeholder',
  standalone: true,
  imports: [FeaturePlaceholderComponent],
  template: `
    <app-feature-placeholder
      eyebrow="Operación"
      title="Sucursales"
      description="Consulta y administra los puntos de operación de la empresa seleccionada."
    />
  `,
})
export class BranchesPlaceholderComponent {}
