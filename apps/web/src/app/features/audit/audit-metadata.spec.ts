import {
  auditActionLabel,
  auditMetadataFields,
  auditResourceLabel,
  normalizeAuditEvent,
} from './audit-metadata';
import type { AuditEvent } from './audit.models';

const event: AuditEvent = {
  id: '11111111-1111-4111-8111-111111111111',
  action: 'reservation.updated',
  resourceType: 'reservacion',
  resourceId: '22222222-2222-4222-8222-222222222222',
  actor: {
    id: '33333333-3333-4333-8333-333333333333',
    nombre: 'Owner',
    email: 'owner@example.test',
    activo: true,
  },
  metadata: {
    previousState: 'BORRADOR',
    newState: 'CONFIRMADA',
    addedDressIds: ['44444444-4444-4444-8444-444444444444'],
    importeRenta: '1250.50',
  },
  ipAddress: '203.0.113.10',
  userAgent: 'Test Browser',
  createdAt: '2026-11-24T15:00:00.000Z',
};

describe('audit metadata projection', () => {
  it('keeps only known metadata and discards secrets and internal fields', () => {
    const normalized = normalizeAuditEvent({
      ...event,
      empresaId: 'must-disappear',
      sessionId: 'must-disappear',
      schemaName: 'tenant_must_disappear',
      metadata: {
        ...event.metadata,
        password: 'must-disappear',
        tokenHash: 'must-disappear',
        headers: { authorization: 'must-disappear' },
        unknown: 'must-disappear',
      },
    });

    expect(normalized).toEqual(event);
    expect(JSON.stringify(normalized)).not.toMatch(
      /empresaId|sessionId|schemaName|password|token|hash|headers|authorization|tenant_/i,
    );
  });

  it('renders known metadata as labeled fields instead of JSON', () => {
    expect(auditMetadataFields(event)).toEqual([
      { label: 'Estado', value: 'BORRADOR → CONFIRMADA' },
      {
        label: 'Vestidos agregados',
        value: '44444444-4444-4444-8444-444444444444',
      },
      { label: 'Importe histórico', value: '1250.50' },
    ]);
    expect(auditActionLabel(event.action)).toBe('Reservación actualizada');
    expect(auditResourceLabel(event.resourceType)).toBe('Reservación');
  });

  it('supports known creation and catalog changes without exposing contact data', () => {
    const normalized = normalizeAuditEvent({
      ...event,
      action: 'dress.updated',
      resourceType: 'vestido',
      metadata: {
        clienteId: '55555555-5555-4555-8555-555555555555',
        initialActive: true,
        initialOperationalStatus: 'DISPONIBLE',
        changes: {
          codigo: { previous: 'GALA-01', new: 'GALA-02' },
          email: { previous: 'old@example.test', new: 'new@example.test' },
          notas: { previous: 'privada', new: 'más privada' },
        },
      },
    });

    expect(auditMetadataFields(normalized)).toEqual([
      { label: 'Cliente', value: '55555555-5555-4555-8555-555555555555' },
      { label: 'Código', value: 'GALA-01 → GALA-02' },
      { label: 'Estado inicial', value: 'Activo' },
      { label: 'Estado operativo inicial', value: 'DISPONIBLE' },
    ]);
    expect(JSON.stringify(normalized.metadata)).not.toMatch(/email|notas|old@example|privada/i);
  });
});
