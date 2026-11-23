import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { ApiClient } from '../../../core/http/api-client.service';
import type {
  PasswordRecoveryResponse,
  RequestPasswordRecoveryInput,
  ResetPasswordInput,
} from './password-recovery.models';

@Injectable({ providedIn: 'root' })
export class PasswordRecoveryApiService {
  private readonly api = inject(ApiClient);

  request(input: RequestPasswordRecoveryInput): Observable<PasswordRecoveryResponse> {
    return this.api
      .post<PasswordRecoveryResponse, RequestPasswordRecoveryInput>(
        'auth/password/solicitar',
        input,
      )
      .pipe(map(({ message }) => ({ message })));
  }

  reset(input: ResetPasswordInput): Observable<PasswordRecoveryResponse> {
    return this.api
      .post<PasswordRecoveryResponse, ResetPasswordInput>('auth/password/restablecer', input)
      .pipe(map(({ message }) => ({ message })));
  }
}
