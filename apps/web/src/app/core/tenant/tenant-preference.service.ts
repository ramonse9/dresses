import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';

const SELECTED_COMPANY_KEY = 'vestidos_empresa_id';

@Injectable({ providedIn: 'root' })
export class TenantPreferenceService {
  private readonly storage = inject(DOCUMENT).defaultView?.localStorage ?? null;

  readCompanyId(): string | null {
    try {
      return this.storage?.getItem(SELECTED_COMPANY_KEY) ?? null;
    } catch {
      return null;
    }
  }

  writeCompanyId(empresaId: string): void {
    try {
      this.storage?.setItem(SELECTED_COMPANY_KEY, empresaId);
    } catch {
      // Storage is an optional convenience and must not prevent tenant selection.
    }
  }

  clearCompanyId(): void {
    try {
      this.storage?.removeItem(SELECTED_COMPANY_KEY);
    } catch {
      // Storage is an optional convenience and must not prevent session cleanup.
    }
  }
}
