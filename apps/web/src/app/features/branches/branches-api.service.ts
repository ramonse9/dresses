import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiClient } from '../../core/http/api-client.service';
import type { Branch, CreateBranchInput, UpdateBranchInput } from './branch.models';

@Injectable({ providedIn: 'root' })
export class BranchesApiService {
  private readonly api = inject(ApiClient);

  list(): Observable<Branch[]> {
    return this.api.get<Branch[]>('sucursales');
  }

  getById(id: string): Observable<Branch> {
    return this.api.get<Branch>(`sucursales/${encodeURIComponent(id)}`);
  }

  create(input: CreateBranchInput): Observable<Branch> {
    return this.api.post<Branch, CreateBranchInput>('sucursales', input);
  }

  update(id: string, input: UpdateBranchInput | { readonly activo: true }): Observable<Branch> {
    return this.api.patch<Branch, UpdateBranchInput | { readonly activo: true }>(
      `sucursales/${encodeURIComponent(id)}`,
      input,
    );
  }

  deactivate(id: string): Observable<Branch> {
    return this.api.delete<Branch>(`sucursales/${encodeURIComponent(id)}`);
  }
}
