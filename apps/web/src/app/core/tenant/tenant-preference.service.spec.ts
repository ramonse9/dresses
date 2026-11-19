import { TestBed } from '@angular/core/testing';
import { TenantPreferenceService } from './tenant-preference.service';

describe('TenantPreferenceService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [TenantPreferenceService] });
  });

  afterEach(() => localStorage.clear());

  it('persists only the non-sensitive company identifier', () => {
    const service = TestBed.inject(TenantPreferenceService);

    service.writeCompanyId('empresa-1');

    expect(service.readCompanyId()).toBe('empresa-1');
    expect(Object.keys(localStorage)).toEqual(['vestidos_empresa_id']);
    expect(JSON.stringify(localStorage)).not.toContain('token');
    expect(JSON.stringify(localStorage)).not.toContain('schemaName');
  });

  it('clears the remembered company', () => {
    const service = TestBed.inject(TenantPreferenceService);
    service.writeCompanyId('empresa-1');

    service.clearCompanyId();

    expect(service.readCompanyId()).toBeNull();
  });
});
