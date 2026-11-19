import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiClient } from '../../core/http/api-client.service';
import type { Branch } from './branch.models';

@Injectable({ providedIn: 'root' })
export class BranchesApiService {
  private readonly api = inject(ApiClient);

  list(): Observable<Branch[]> {
    return this.api.get<Branch[]>('sucursales');
  }

  getById(id: string): Observable<Branch> {
    return this.api.get<Branch>(`sucursales/${encodeURIComponent(id)}`);
  }
}
