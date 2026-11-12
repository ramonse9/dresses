# Dresses SaaS

Base de un SaaS multi-tenant para negocios de renta de vestidos. El proyecto contiene una aplicación web, un API con health check y la infraestructura local de PostgreSQL con TypeORM. Todavía no incluye módulos de negocio ni autenticación.

## Tecnologías

- Angular 22 standalone
- Tailwind CSS 4
- NestJS 12 con TypeScript
- PostgreSQL con TypeORM
- npm workspaces

## Estructura

```text
.
├── apps
│   ├── api    # API NestJS
│   └── web    # Aplicación Angular
├── package.json
└── README.md
```

## Requisitos

- Node.js 24 o posterior
- npm 11 o posterior
- PostgreSQL 15 o posterior

## Instalación

Desde la raíz del proyecto:

```bash
npm install
```

## Base de datos local

Inicia PostgreSQL y crea la base de datos vacía:

```bash
createdb vestidos_saas
```

Si necesitas especificar el usuario administrador:

```bash
psql -U postgres -c 'CREATE DATABASE vestidos_saas;'
```

Copia el archivo de variables y reemplaza el usuario y la contraseña con los valores de tu instalación local:

```bash
cp apps/api/.env.example apps/api/.env
```

```dotenv
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=tu_password_local
DB_DATABASE=vestidos_saas
DB_SSL=false
DB_POOL_MAX=10
ENABLE_DEV_TENANT_ADMIN=false
```

El archivo `.env` está ignorado por Git. TypeORM tiene `synchronize: false`; los cambios de esquema se gestionan exclusivamente mediante migrations.

## Migrations

Consultar y ejecutar migrations pendientes desde la raíz:

```bash
npm run migration:show
npm run migration:run
```

Revertir la última migration:

```bash
npm run migration:revert
```

Crear una migration manual vacía:

```bash
npm run migration:create --workspace=api -- src/database/migrations/NombreMigration
```

Cuando existan entidades, generar una migration a partir de los cambios de esquema:

```bash
npm run migration:generate --workspace=api -- src/database/migrations/NombreMigration
```

Las migrations de `public` se mantienen separadas de las migrations que se ejecutan dentro de cada tenant.

## Arquitectura multi-tenant

- El schema `public` contiene información global, comenzando por la tabla `empresas`.
- Cada boutique tendrá un schema PostgreSQL independiente.
- Los schemas de tenant siguen exclusivamente el formato `tenant_<uuid_sin_guiones>`, por ejemplo `tenant_019a6f3382b77a22971b6a8d7c5e4f30`.
- El nombre se deriva internamente del UUID de `Empresa`; nunca se toma un nombre de schema, slug o identificador SQL enviado por el cliente.
- PostgreSQL aplica además una restricción `CHECK` al campo `schema_name` y un índice único.

La autenticación todavía no está implementada. El módulo `EmpresasModule` usa repositorios parametrizados de TypeORM y nunca acepta identificadores SQL desde el cliente.

## Usuarios y membresías

Los usuarios y sus accesos a empresas son información global y viven exclusivamente en `public`:

- `public.usuarios`: UUID, email, `password_hash`, nombre, estado y timestamps.
- `public.empresa_usuarios`: relación entre usuario y empresa, rol, estado y fecha de creación.
- Roles iniciales: `OWNER` y `EMPLOYEE`.
- Un usuario solo puede tener una membresía por empresa.

El email se normaliza con `trim().toLowerCase()` antes de persistir. PostgreSQL exige además que el valor almacenado esté en minúsculas y mantiene un índice único. `passwordHash` tiene `select: false` en TypeORM y `Usuario.toJSON()` utiliza una lista explícita de campos públicos, por lo que el hash no aparece en consultas normales ni serializaciones.

`UsuariosModule` exporta servicios de consulta para buscar usuarios activos y membresías activas. No existen endpoints de usuarios, registro público, hashing de contraseñas, login ni JWT en esta etapa. Las credenciales tampoco se almacenan dentro de schemas tenant.

La migration global correspondiente es `CreateUsuariosMemberships1794442297164` y crea las llaves foráneas hacia `public.usuarios` y `public.empresas` con eliminación restringida.

## Crear un tenant

La creación de empresas es una operación administrativa temporal de desarrollo. Para habilitarla localmente establece `ENABLE_DEV_TENANT_ADMIN=true`; en `NODE_ENV=production` permanece bloqueada aunque la bandera esté activa.

Con el API y PostgreSQL en ejecución, crea una empresa enviando únicamente `nombre` y `slug`:

```bash
curl --request POST http://localhost:3000/api/empresas \
  --header 'Content-Type: application/json' \
  --data '{"nombre":"Atelier Norte","slug":"atelier-norte"}'
```

El backend genera el UUID y `schemaName`; el cliente no puede proporcionar el nombre del schema. La respuesta tiene esta forma:

```json
{
  "id": "019a6f33-82b7-7a22-971b-6a8d7c5e4f30",
  "nombre": "Atelier Norte",
  "slug": "atelier-norte",
  "schemaName": "tenant_019a6f3382b77a22971b6a8d7c5e4f30",
  "activo": true,
  "createdAt": "2026-11-11T00:00:00.000Z"
}
```

La empresa, el schema y sus migrations se crean dentro de una sola transacción. Un fallo revierte todos los pasos y un slug repetido responde con HTTP `409`. Las migrations del tenant crean su tabla de control y la tabla `sucursales`.

Verifica el registro y el schema desde `psql`:

```sql
SELECT id, nombre, slug, schema_name, activo FROM public.empresas;
SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%';
SELECT * FROM tenant_019a6f3382b77a22971b6a8d7c5e4f30.tenant_migrations;
```

## Sucursales

Las sucursales viven exclusivamente dentro del schema de su empresa. El slug de la ruta se utiliza para buscar la empresa en `public`; el nombre real del schema siempre se obtiene del registro interno.

```text
POST   /api/empresas/:empresaSlug/sucursales
GET    /api/empresas/:empresaSlug/sucursales
GET    /api/empresas/:empresaSlug/sucursales/:id
PATCH  /api/empresas/:empresaSlug/sucursales/:id
DELETE /api/empresas/:empresaSlug/sucursales/:id
```

Crear una sucursal:

```bash
curl --request POST http://localhost:3000/api/empresas/atelier-norte/sucursales \
  --header 'Content-Type: application/json' \
  --data '{"nombre":"Centro","direccion":"Av. Principal 123","telefono":"555-0100"}'
```

Actualizar o reactivar:

```bash
curl --request PATCH http://localhost:3000/api/empresas/atelier-norte/sucursales/ID \
  --header 'Content-Type: application/json' \
  --data '{"nombre":"Centro Histórico","activo":true}'
```

`DELETE` realiza una baja lógica estableciendo `activo=false`; nunca elimina físicamente la sucursal. Los nombres son obligatorios y únicos, sin distinguir mayúsculas, dentro de cada empresa. La llave UUID de `sucursales` queda preparada para futuras relaciones desde vestidos y reservaciones dentro del mismo schema.

## Aislamiento de tenants

Las consultas de datos de tenant siguen una única ruta reutilizable:

1. El controlador recibe un slug de empresa, nunca un schema.
2. `TenantResolverService` consulta `public.empresas` y construye un `TenantScope` inmutable.
3. El scope comprueba que `schemaName` coincide exactamente con el UUID de la empresa; no basta con que tenga un formato válido.
4. `TenantContextService` reserva una conexión del pool, inicia una transacción y ejecuta `SET LOCAL search_path TO <tenant>, pg_catalog`.
5. La operación recibe solamente un `EntityManager` ligado a esa transacción.
6. `COMMIT` o `ROLLBACK` elimina automáticamente el cambio local de `search_path` antes de devolver la conexión al pool.

No se utiliza `SET search_path` de sesión ni se aceptan nombres de schema en headers, parámetros HTTP o DTOs. `public` tampoco se incluye como fallback dentro de una operación tenant: las consultas globales se resuelven antes, fuera del contexto tenant. `DB_POOL_MAX` permite ajustar el tamaño del pool sin cambiar este comportamiento.

Para la futura autenticación, un guard JWT podrá tomar un `empresaId` verificado y llamar `TenantResolverService.resolveByEmpresaId()`. La resolución, validación UUID↔schema y ejecución transaccional no tendrán que cambiar. Actualmente no se confía en claims ni headers porque la autenticación todavía no está implementada.

### Prueba PostgreSQL de aislamiento

La suite crea dos empresas temporales y varias sucursales, permite el mismo nombre en tenants distintos, rechaza acceder desde una empresa a la sucursal de otra y fuerza `DB_POOL_MAX=1` para comprobar que `search_path` vuelve a `public` al reutilizar la conexión.

```bash
NODE_ENV=test \
DB_HOST=127.0.0.1 \
DB_PORT=5432 \
DB_USERNAME=tu_usuario \
DB_PASSWORD=tu_password \
DB_DATABASE=vestidos_saas \
DB_SSL=false \
DB_POOL_MAX=1 \
npm run test:tenancy
```

La suite elimina en `afterAll` únicamente las empresas y schemas temporales que ella misma creó.

## Desarrollo

Para iniciar el API y la aplicación web al mismo tiempo:

```bash
npm run dev
```

También se pueden ejecutar por separado:

```bash
npm run dev:api
npm run dev:web
```

- Web: <http://localhost:4200>
- API: <http://localhost:3000>
- Health check de API y PostgreSQL: <http://localhost:3000/api/health>

Con PostgreSQL conectado, el endpoint responde:

```json
{
  "status": "ok",
  "service": "dresses-api",
  "database": { "status": "up" }
}
```

La verificación ejecuta `SELECT 1` mediante `DatabaseHealthService`. Si se pierde una conexión ya inicializada, el estado cambia a `degraded` y la base de datos a `down`.

El API acepta solicitudes CORS de `http://localhost:4200` y `http://127.0.0.1:4200` durante el desarrollo local.

## Validaciones

```bash
npm run build
npm test
npm run lint
npm run test:e2e --workspace=api
npm run test:tenancy
```

Los scripts se ejecutan desde la raíz y delegan a cada workspace cuando corresponde.
