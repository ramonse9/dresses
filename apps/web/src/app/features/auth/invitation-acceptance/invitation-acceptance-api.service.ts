import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { ApiClient } from '../../../core/http/api-client.service';
import type {
  AcceptedInvitationResponse,
  AcceptInvitationInput,
  VerifiedInvitation,
} from './invitation-acceptance.models';

@Injectable({ providedIn: 'root' })
export class InvitationAcceptanceApiService {
  private readonly api = inject(ApiClient);

  verify(token: string): Observable<VerifiedInvitation> {
    return this.api
      .post<VerifiedInvitation, { readonly token: string }>('auth/invitaciones/verificar', {
        token,
      })
      .pipe(
        map((response) => ({
          empresaNombre: response.empresaNombre,
          email: response.email,
          rol: response.rol,
          expiresAt: response.expiresAt,
          accountExists: response.accountExists,
        })),
      );
  }

  accept(input: AcceptInvitationInput): Observable<AcceptedInvitationResponse> {
    return this.api
      .post<AcceptedInvitationResponse, AcceptInvitationInput>('auth/invitaciones/aceptar', input)
      .pipe(map(({ accepted, message }) => ({ accepted, message })));
  }
}
