import { Injectable } from '@angular/core';

export type TenantResetCallback = () => void;

@Injectable({ providedIn: 'root' })
export class TenantResetRegistry {
  private readonly callbacks = new Set<TenantResetCallback>();

  register(callback: TenantResetCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  resetAll(): void {
    for (const callback of this.callbacks) {
      callback();
    }
  }
}
