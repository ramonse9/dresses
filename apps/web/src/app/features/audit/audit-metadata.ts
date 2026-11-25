import {
  AUDIT_ACTIONS,
  AUDIT_RESOURCE_TYPES,
  type AuditAction,
  type AuditEvent,
  type AuditResourceType,
  type SafeAuditMetadata,
} from './audit.models';

export interface AuditMetadataField {
  readonly label: string;
  readonly value: string;
}

const safeStringKeys = new Set([
  'previousRole',
  'newRole',
  'role',
  'previousOperationalStatus',
  'newOperationalStatus',
  'previousState',
  'newState',
  'previousSucursalId',
  'newSucursalId',
  'importeRenta',
  'depositoRequerido',
  'initialOperationalStatus',
]);
const safeBooleanKeys = new Set([
  'previousActive',
  'newActive',
  'initialActive',
  'current',
  'notesChanged',
  'hasCancellationReason',
]);
const safeArrayKeys = new Set(['changedFields', 'addedDressIds', 'removedDressIds']);
const safeIdentifierChangeKeys = new Set(['clienteId', 'sucursalId']);
const safeChangeKeys = new Set([
  'nombre',
  'codigo',
  'talla',
  'color',
  'marca',
  'precioRenta',
  'deposito',
]);

const actionLabels: Record<AuditAction, string> = {
  'auth.login.succeeded': 'Inicio de sesión',
  'auth.logout': 'Cierre de sesión',
  'membership.role.changed': 'Rol de miembro actualizado',
  'membership.activated': 'Membresía activada',
  'membership.deactivated': 'Membresía desactivada',
  'invitation.created': 'Invitación creada',
  'invitation.resent': 'Invitación reenviada',
  'invitation.revoked': 'Invitación revocada',
  'invitation.accepted': 'Invitación aceptada',
  'password.reset.completed': 'Contraseña restablecida',
  'session.revoked': 'Sesión revocada',
  'session.others.revoked': 'Otras sesiones revocadas',
  'branch.created': 'Sucursal creada',
  'branch.updated': 'Sucursal actualizada',
  'branch.activated': 'Sucursal activada',
  'branch.deactivated': 'Sucursal desactivada',
  'customer.created': 'Cliente creado',
  'customer.updated': 'Cliente actualizado',
  'customer.activated': 'Cliente activado',
  'customer.deactivated': 'Cliente desactivado',
  'dress.created': 'Vestido creado',
  'dress.updated': 'Vestido actualizado',
  'dress.transferred': 'Vestido trasladado',
  'dress.activated': 'Vestido activado',
  'dress.deactivated': 'Vestido desactivado',
  'dress.operational_status.changed': 'Estado operativo actualizado',
  'reservation.created': 'Reservación creada',
  'reservation.updated': 'Reservación actualizada',
  'reservation.confirmed': 'Reservación confirmada',
  'reservation.delivered': 'Reservación entregada',
  'reservation.returned': 'Reservación devuelta',
  'reservation.cancelled': 'Reservación cancelada',
  'tenant.resource.created': 'Recurso tenant creado',
  'tenant.resource.updated': 'Recurso tenant actualizado',
  'tenant.resource.deactivated': 'Recurso tenant desactivado',
  'tenant.resource.state.changed': 'Estado de recurso tenant actualizado',
};

const resourceLabels: Record<AuditResourceType, string> = {
  auth_session: 'Sesión',
  usuario: 'Usuario',
  empresa_usuario: 'Membresía',
  empresa_invitacion: 'Invitación',
  sucursal: 'Sucursal',
  cliente: 'Cliente',
  vestido: 'Vestido',
  reservacion: 'Reservación',
};

export function auditActionLabel(action: AuditAction): string {
  return actionLabels[action];
}

export function auditResourceLabel(resourceType: AuditResourceType): string {
  return resourceLabels[resourceType];
}

export function normalizeAuditEvent(value: unknown): AuditEvent {
  const event = requireRecord(value);
  const action = requireIncluded(event['action'], AUDIT_ACTIONS, 'acción');
  const resourceType = requireIncluded(
    event['resourceType'],
    AUDIT_RESOURCE_TYPES,
    'tipo de recurso',
  );

  return {
    id: requireString(event['id'], 'id'),
    action,
    resourceType,
    resourceId: optionalString(event['resourceId']),
    actor: normalizeActor(event['actor']),
    metadata: normalizeAuditMetadata(event['metadata']),
    ipAddress: optionalString(event['ipAddress']),
    userAgent: optionalString(event['userAgent']),
    createdAt: requireIsoDate(event['createdAt']),
  };
}

export function normalizeAuditMetadata(value: unknown): SafeAuditMetadata {
  if (!isRecord(value)) return {};
  const normalized: Record<string, unknown> = {};

  for (const [key, entry] of Object.entries(value)) {
    if (safeStringKeys.has(key) && (typeof entry === 'string' || entry === null)) {
      normalized[key] = entry;
    } else if (safeBooleanKeys.has(key) && typeof entry === 'boolean') {
      normalized[key] = entry;
    } else if (safeArrayKeys.has(key) && isStringArray(entry)) {
      normalized[key] = entry;
    } else if (key === 'revokedSessionCount' && isNonNegativeNumber(entry)) {
      normalized[key] = entry;
    } else if (safeIdentifierChangeKeys.has(key)) {
      if (typeof entry === 'string') normalized[key] = entry;
      else {
        const change = normalizePreviousAndNew(entry);
        if (change) normalized[key] = change;
      }
    } else if (key === 'range') {
      const range = normalizeRange(entry);
      if (range) normalized[key] = range;
    } else if (key === 'changes') {
      const changes = normalizeChanges(entry);
      if (Object.keys(changes).length > 0) normalized[key] = changes;
    }
  }

  return normalized;
}

export function auditMetadataFields(event: AuditEvent): readonly AuditMetadataField[] {
  const metadata = event.metadata;
  const fields: AuditMetadataField[] = [];
  addTransition(fields, metadata, 'previousState', 'newState', 'Estado');
  addTransition(fields, metadata, 'previousRole', 'newRole', 'Rol');
  addTransition(
    fields,
    metadata,
    'previousOperationalStatus',
    'newOperationalStatus',
    'Estado operativo',
  );
  addTransition(fields, metadata, 'previousActive', 'newActive', 'Estado de acceso');
  addTransition(fields, metadata, 'previousSucursalId', 'newSucursalId', 'Sucursal');
  addIdentifierChange(fields, metadata, 'clienteId', 'Cliente');
  addIdentifierChange(fields, metadata, 'sucursalId', 'Sucursal');
  addSimple(fields, metadata, 'clienteId', 'Cliente');
  addSimple(fields, metadata, 'sucursalId', 'Sucursal');
  addRange(fields, metadata);
  addStringArray(fields, metadata, 'changedFields', 'Campos modificados');
  addChanges(fields, metadata);
  addStringArray(fields, metadata, 'addedDressIds', 'Vestidos agregados');
  addStringArray(fields, metadata, 'removedDressIds', 'Vestidos retirados');
  addSimple(fields, metadata, 'importeRenta', 'Importe histórico');
  addSimple(fields, metadata, 'depositoRequerido', 'Depósito histórico');
  addSimple(fields, metadata, 'revokedSessionCount', 'Sesiones revocadas');
  if (metadata['initialActive'] === true) {
    fields.push({ label: 'Estado inicial', value: 'Activo' });
  }
  if (typeof metadata['initialOperationalStatus'] === 'string') {
    fields.push({
      label: 'Estado operativo inicial',
      value: metadata['initialOperationalStatus'],
    });
  }
  if (typeof metadata['current'] === 'boolean') {
    fields.push({ label: 'Sesión actual', value: metadata['current'] ? 'Sí' : 'No' });
  }
  if (metadata['notesChanged'] === true) fields.push({ label: 'Notas', value: 'Modificadas' });
  if (metadata['hasCancellationReason'] === true) {
    fields.push({ label: 'Motivo de cancelación', value: 'Registrado' });
  }
  if (typeof metadata['role'] === 'string') {
    fields.push({ label: 'Rol', value: metadata['role'] });
  }
  return fields;
}

export function auditSummary(event: AuditEvent): string {
  const fields = auditMetadataFields(event);
  return fields[0]?.value ?? 'Sin detalles adicionales';
}

function normalizeActor(value: unknown): AuditEvent['actor'] {
  if (value === null || value === undefined) return null;
  const actor = requireRecord(value);
  return {
    id: requireString(actor['id'], 'actor.id'),
    nombre: optionalString(actor['nombre']),
    email: optionalString(actor['email']),
    activo: typeof actor['activo'] === 'boolean' ? actor['activo'] : null,
  };
}

function normalizePreviousAndNew(value: unknown): Record<string, string | null> | null {
  if (!isRecord(value)) return null;
  const previous = optionalString(value['previous']);
  const next = optionalString(value['new']);
  return previous !== null || next !== null ? { previous, new: next } : null;
}

function normalizeChanges(value: unknown): Record<string, Record<string, string | null>> {
  if (!isRecord(value)) return {};
  const normalized: Record<string, Record<string, string | null>> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!safeChangeKeys.has(key)) continue;
    const change = normalizePreviousAndNew(entry);
    if (change) normalized[key] = change;
  }
  return normalized;
}

function normalizeRange(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) return null;
  const previous = normalizeDateRange(value['previous']);
  const next = normalizeDateRange(value['new']);
  return previous || next ? { previous, new: next } : null;
}

function normalizeDateRange(value: unknown): Record<string, string> | null {
  if (!isRecord(value)) return null;
  const fechaInicio = optionalIsoDate(value['fechaInicio']);
  const fechaFin = optionalIsoDate(value['fechaFin']);
  return fechaInicio && fechaFin ? { fechaInicio, fechaFin } : null;
}

function addTransition(
  fields: AuditMetadataField[],
  metadata: SafeAuditMetadata,
  previousKey: string,
  newKey: string,
  label: string,
): void {
  const previous = metadata[previousKey];
  const next = metadata[newKey];
  if (
    previousKey in metadata &&
    newKey in metadata &&
    (typeof previous === 'string' || typeof previous === 'boolean' || previous === null) &&
    (typeof next === 'string' || typeof next === 'boolean' || next === null)
  ) {
    fields.push({ label, value: `${displayValue(previous)} → ${displayValue(next)}` });
  }
}

function addIdentifierChange(
  fields: AuditMetadataField[],
  metadata: SafeAuditMetadata,
  key: string,
  label: string,
): void {
  const change = metadata[key];
  if (isRecord(change)) {
    fields.push({
      label,
      value: `${optionalString(change['previous']) ?? 'Sin asignar'} → ${optionalString(change['new']) ?? 'Sin asignar'}`,
    });
  }
}

function addChanges(fields: AuditMetadataField[], metadata: SafeAuditMetadata): void {
  const changes = metadata['changes'];
  if (!isRecord(changes)) return;
  const labels: Record<string, string> = {
    nombre: 'Nombre',
    codigo: 'Código',
    talla: 'Talla',
    color: 'Color',
    marca: 'Marca',
    precioRenta: 'Precio de renta',
    deposito: 'Depósito',
  };
  for (const [key, entry] of Object.entries(changes)) {
    if (!safeChangeKeys.has(key) || !isRecord(entry)) continue;
    fields.push({
      label: labels[key] ?? key,
      value: `${optionalString(entry['previous']) ?? 'Sin valor'} → ${optionalString(entry['new']) ?? 'Sin valor'}`,
    });
  }
}

function addRange(fields: AuditMetadataField[], metadata: SafeAuditMetadata): void {
  const range = metadata['range'];
  if (!isRecord(range)) return;
  const previous = formatRange(range['previous']);
  const next = formatRange(range['new']);
  if (previous || next)
    fields.push({ label: 'Rango', value: `${previous ?? 'Sin rango'} → ${next ?? 'Sin rango'}` });
}

function addStringArray(
  fields: AuditMetadataField[],
  metadata: SafeAuditMetadata,
  key: string,
  label: string,
): void {
  const values = metadata[key];
  if (isStringArray(values) && values.length > 0) fields.push({ label, value: values.join(', ') });
}

function addSimple(
  fields: AuditMetadataField[],
  metadata: SafeAuditMetadata,
  key: string,
  label: string,
): void {
  const value = metadata[key];
  if (typeof value === 'string' || typeof value === 'number') {
    fields.push({ label, value: String(value) });
  }
}

function formatRange(value: unknown): string | null {
  if (!isRecord(value)) return null;
  const start = optionalIsoDate(value['fechaInicio']);
  const end = optionalIsoDate(value['fechaFin']);
  return start && end ? `${formatDate(start)} — ${formatDate(end)}` : null;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}

function displayValue(value: string | boolean | null): string {
  if (value === null) return 'Sin valor';
  return typeof value === 'boolean' ? (value ? 'Activo' : 'Inactivo') : value;
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new Error('La respuesta de auditoría no es válida.');
  return value;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Campo inválido: ${field}`);
  return value;
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function requireIsoDate(value: unknown): string {
  const date = optionalIsoDate(value);
  if (!date) throw new Error('Fecha de auditoría inválida.');
  return date;
}

function optionalIsoDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function requireIncluded<const T extends readonly string[]>(
  value: unknown,
  values: T,
  field: string,
): T[number] {
  if (typeof value !== 'string' || !values.includes(value)) {
    throw new Error(`La ${field} de auditoría no es válida.`);
  }
  return value;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
