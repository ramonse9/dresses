import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AccessTokenStore {
  private readonly value = signal<string | null>(null);

  readonly token = this.value.asReadonly();

  set(accessToken: string): void {
    this.value.set(accessToken);
  }

  clear(): void {
    this.value.set(null);
  }
}
