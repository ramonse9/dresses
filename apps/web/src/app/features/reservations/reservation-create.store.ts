import { inject, Injectable, signal } from '@angular/core';
import { catchError, Observable, Subject, takeUntil, tap, throwError } from 'rxjs';
import { normalizeApiError, type ApiError } from '../../core/http/api-error';
import { TenantResetRegistry } from '../../core/tenant/tenant-reset-registry.service';
import { AvailabilityApiService } from '../availability/availability-api.service';
import type {
  AvailabilityFilters,
  AvailabilityResponse,
} from '../availability/availability.models';
import { CustomersApiService } from '../customers/customers-api.service';
import type { Customer } from '../customers/customer.models';
import type { CreateReservationInput, ReservationDetail } from './reservation.models';
import { ReservationsApiService } from './reservations-api.service';

export type SupportLoadState = 'idle' | 'loading' | 'loaded' | 'empty' | 'error';

@Injectable({ providedIn: 'root' })
export class ReservationCreateStore {
  private readonly customersApi = inject(CustomersApiService);
  private readonly availabilityApi = inject(AvailabilityApiService);
  private readonly reservationsApi = inject(ReservationsApiService);
  private readonly resetRegistry = inject(TenantResetRegistry);
  private readonly resetRequests = new Subject<void>();
  private readonly customersValue = signal<readonly Customer[]>([]);
  private readonly customersStatusValue = signal<SupportLoadState>('idle');
  private readonly customersErrorValue = signal<ApiError | null>(null);
  private readonly availabilityValue = signal<AvailabilityResponse | null>(null);
  private readonly availabilityStatusValue = signal<SupportLoadState>('idle');
  private readonly availabilityErrorValue = signal<ApiError | null>(null);
  private customerRequestId = 0;
  private availabilityRequestId = 0;

  readonly customers = this.customersValue.asReadonly();
  readonly customersStatus = this.customersStatusValue.asReadonly();
  readonly customersError = this.customersErrorValue.asReadonly();
  readonly availability = this.availabilityValue.asReadonly();
  readonly availabilityStatus = this.availabilityStatusValue.asReadonly();
  readonly availabilityError = this.availabilityErrorValue.asReadonly();

  constructor() {
    this.resetRegistry.register(() => this.reset());
  }

  searchCustomers(q?: string): Observable<void> {
    const requestId = ++this.customerRequestId;
    this.customersStatusValue.set('loading');
    this.customersErrorValue.set(null);
    return new Observable<void>((subscriber) => {
      const subscription = this.customersApi
        .list({ page: 1, limit: 20, activo: true, ...(q ? { q } : {}) })
        .pipe(takeUntil(this.resetRequests))
        .subscribe({
          next: (response) => {
            if (requestId === this.customerRequestId) {
              this.customersValue.set(response.data);
              this.customersStatusValue.set(response.data.length ? 'loaded' : 'empty');
            }
            subscriber.next();
            subscriber.complete();
          },
          error: (error: unknown) => {
            if (requestId === this.customerRequestId) {
              this.customersValue.set([]);
              this.customersStatusValue.set('error');
              this.customersErrorValue.set(normalizeApiError(error));
            }
            subscriber.next();
            subscriber.complete();
          },
        });
      return () => subscription.unsubscribe();
    });
  }

  loadAvailability(filters: AvailabilityFilters): Observable<AvailabilityResponse> {
    const requestId = ++this.availabilityRequestId;
    this.availabilityStatusValue.set('loading');
    this.availabilityValue.set(null);
    this.availabilityErrorValue.set(null);
    return this.availabilityApi.find(filters).pipe(
      takeUntil(this.resetRequests),
      tap((response) => {
        if (requestId === this.availabilityRequestId) {
          this.availabilityValue.set(response);
          this.availabilityStatusValue.set(response.data.length ? 'loaded' : 'empty');
        }
      }),
      catchError((error: unknown) => {
        if (requestId === this.availabilityRequestId) {
          this.availabilityStatusValue.set('error');
          this.availabilityErrorValue.set(normalizeApiError(error));
        }
        return throwError(() => error);
      }),
    );
  }

  clearAvailability(): void {
    this.availabilityRequestId += 1;
    this.availabilityValue.set(null);
    this.availabilityStatusValue.set('idle');
    this.availabilityErrorValue.set(null);
  }

  create(input: CreateReservationInput): Observable<ReservationDetail> {
    return this.reservationsApi.create(input).pipe(takeUntil(this.resetRequests));
  }

  reset(): void {
    this.customerRequestId += 1;
    this.availabilityRequestId += 1;
    this.resetRequests.next();
    this.customersValue.set([]);
    this.customersStatusValue.set('idle');
    this.customersErrorValue.set(null);
    this.clearAvailability();
  }
}
