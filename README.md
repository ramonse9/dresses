# Dresses SaaS

Base de un SaaS multi-tenant para negocios de renta de vestidos. El proyecto contiene una aplicación web, un API con autenticación JWT y la infraestructura local de PostgreSQL con TypeORM. Los módulos de negocio de vestidos y reservaciones todavía no están implementados.

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
JWT_ACCESS_SECRET=un_secreto_local_aleatorio_de_al_menos_32_bytes
JWT_ACCESS_TTL_SECONDS=900
AUTH_REFRESH_TTL_SECONDS=2592000
```

El archivo `.env` está ignorado por Git. TypeORM tiene `synchronize: false`; los cambios de esquema se gestionan exclusivamente mediante migrations.

Genera un secreto local distinto para cada entorno, por ejemplo:

```bash
openssl rand -base64 32
```

Guarda el resultado únicamente en `apps/api/.env`. `JWT_ACCESS_TTL_SECONDS` acepta entre 60 y 3600 segundos; el valor sugerido de desarrollo es 900 segundos (15 minutos). `AUTH_REFRESH_TTL_SECONDS` define la duración absoluta de una sesión entre 1 hora y 90 días; el valor sugerido es 2592000 segundos (30 días).

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

La autenticación identifica al usuario, pero todavía no selecciona una empresa. El módulo `EmpresasModule` usa repositorios parametrizados de TypeORM y nunca acepta identificadores SQL desde el cliente.

## Usuarios y membresías

Los usuarios y sus accesos a empresas son información global y viven exclusivamente en `public`:

- `public.usuarios`: UUID, email, `password_hash`, nombre, estado y timestamps.
- `public.empresa_usuarios`: relación entre usuario y empresa, rol, estado y fecha de creación.
- Roles iniciales: `OWNER` y `EMPLOYEE`.
- Un usuario solo puede tener una membresía por empresa.

El email se normaliza con `trim().toLowerCase()` antes de persistir. PostgreSQL exige además que el valor almacenado esté en minúsculas y mantiene un índice único. `passwordHash` tiene `select: false` en TypeORM y `Usuario.toJSON()` utiliza una lista explícita de campos públicos, por lo que el hash no aparece en consultas normales ni serializaciones.

`UsuariosModule` exporta servicios de consulta para buscar usuarios activos y membresías activas. No existen endpoints de usuarios ni registro público. Las credenciales tampoco se almacenan dentro de schemas tenant.

La migration global correspondiente es `CreateUsuariosMemberships1794442297164` y crea las llaves foráneas hacia `public.usuarios` y `public.empresas` con eliminación restringida.

Las sesiones también son globales y viven en `public.auth_sessions`. Cada registro pertenece a un usuario y contiene únicamente el hash del refresh token, su expiración y el momento opcional de revocación. La migration `CreateAuthSessions1794528000000` crea esta tabla y sus índices.

## Autenticación JWT

`AuthModule` implementa autenticación básica sin abrir registro público:

```text
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
GET  /api/auth/me
GET  /api/auth/empresas
POST /api/auth/select-empresa
```

Las contraseñas se almacenan exclusivamente como hashes Argon2id. `PasswordHashService` centraliza tanto la creación del hash como su verificación, y el login hace una comparación segura incluso cuando el email no existe para reducir diferencias observables. La aplicación no registra contraseñas ni las incluye en respuestas.

El login recibe únicamente `email` y `password`. El email se normaliza a minúsculas antes de consultar `public.usuarios`; un usuario inexistente, inactivo o con contraseña incorrecta recibe el mismo error genérico `401`.

```bash
curl --request POST http://localhost:3000/api/auth/login \
  --header 'Content-Type: application/json' \
  --data '{"email":"owner@example.com","password":"tu-password"}'
```

La respuesta contiene un access token de corta duración y un refresh token opaco:

```json
{
  "accessToken": "eyJ...",
  "refreshToken": "C0g...token_opaco...",
  "tokenType": "Bearer",
  "expiresIn": 900
}
```

El JWT inicial contiene `sub`, `email` y un `sessionId` aleatorio, además de los timestamps estándar del token. No contiene `schemaName`, empresa ni membresía. El refresh token contiene 256 bits aleatorios y no es un JWT. La base de datos guarda solamente su hash SHA-256; ni el token completo ni las contraseñas se registran.

Usa el refresh token para obtener un nuevo par de tokens:

```bash
curl --request POST http://localhost:3000/api/auth/refresh \
  --header 'Content-Type: application/json' \
  --data '{"refreshToken":"TOKEN_ACTUAL"}'
```

Cada refresh rota el token dentro de una transacción con bloqueo de fila. El hash anterior se reemplaza antes de confirmar la transacción, por lo que el token anterior deja de funcionar inmediatamente. La fecha de expiración absoluta de la sesión no se extiende al rotar.

Verifica el token mediante el guard reutilizable en el endpoint protegido:

```bash
curl http://localhost:3000/api/auth/me \
  --header 'Authorization: Bearer eyJ...'
```

La respuesta expone únicamente la identidad incluida en el token:

```json
{
  "sub": "019a6f33-82b7-7a22-971b-6a8d7c5e4f30",
  "email": "owner@example.com",
  "sessionId": "47ecf96a-8f2c-4e07-bd1f-93936f2cdb90"
}
```

### Selección de empresa

Después de autenticarte, consulta las empresas activas para las que el usuario conserva una membresía activa:

```bash
curl http://localhost:3000/api/auth/empresas \
  --header 'Authorization: Bearer eyJ...'
```

La respuesta permite presentar varias empresas sin revelar información interna del tenant:

```json
[
  {
    "id": "a18c2a56-d33f-4d88-a8e7-42931121e295",
    "nombre": "Atelier Norte",
    "slug": "atelier-norte",
    "rol": "OWNER"
  }
]
```

Selecciona una empresa enviando exclusivamente su UUID:

```bash
curl --request POST http://localhost:3000/api/auth/select-empresa \
  --header 'Authorization: Bearer eyJ...' \
  --header 'Content-Type: application/json' \
  --data '{"empresaId":"a18c2a56-d33f-4d88-a8e7-42931121e295"}'
```

El backend comprueba que la sesión, el usuario, la empresa y la membresía estén activos. Después resuelve internamente el `TenantScope` desde `empresaId` y emite un access token nuevo con `sub`, `sessionId`, `empresaId` y `rol`, además del email ya autenticado. `schemaName` nunca se recibe, devuelve ni incluye en el JWT.

La selección no modifica la sesión ni impide que un usuario elija posteriormente otra empresa para la que tenga membresía. Un refresh token emite nuevamente un access token sin empresa seleccionada; el cliente debe repetir la selección para evitar conservar un contexto tenant que pudiera haber cambiado.

Revoca la sesión actual usando su access token:

```bash
curl --request POST http://localhost:3000/api/auth/logout \
  --header 'Authorization: Bearer eyJ...'
```

`logout` responde con HTTP `204`. El guard JWT consulta la sesión en `public` en cada petición protegida, por lo que una sesión revocada o expirada, o perteneciente a un usuario inactivo, deja de aceptar incluso access tokens que aún no hayan vencido. El endpoint de refresh aplica las mismas verificaciones.

Puedes inspeccionar las sesiones sin exponer tokens completos:

```sql
SELECT id, usuario_id, expires_at, revoked_at, created_at, updated_at
FROM public.auth_sessions;
```

La prueba PostgreSQL de autenticación comprueba el hash de refresh tokens, la rotación concurrente y la revocación. También crea dos usuarios y dos empresas temporales para validar acceso a múltiples empresas, roles, membresías inactivas y rechazo de selección cruzada. Todos los datos y schemas de prueba se eliminan al finalizar:

```bash
npm run test:auth-database
```

Como no existe registro público, el usuario debe haber sido aprovisionado previamente en `public.usuarios` por un proceso administrativo y su `password_hash` debe ser generado con Argon2id. No se incluyen todavía recuperación de contraseña, invitaciones de usuarios ni administración de sesiones desde la interfaz.

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

Las sucursales viven exclusivamente dentro del schema de su empresa. Todas sus rutas requieren un access token emitido después de seleccionar empresa; el tenant se obtiene únicamente del `TenantScope` autenticado.

```text
POST   /api/sucursales
GET    /api/sucursales
GET    /api/sucursales/:id
PATCH  /api/sucursales/:id
DELETE /api/sucursales/:id
```

Crear una sucursal:

```bash
curl --request POST http://localhost:3000/api/sucursales \
  --header 'Authorization: Bearer TOKEN_CON_EMPRESA' \
  --header 'Content-Type: application/json' \
  --data '{"nombre":"Centro","direccion":"Av. Principal 123","telefono":"555-0100"}'
```

Actualizar o reactivar:

```bash
curl --request PATCH http://localhost:3000/api/sucursales/ID \
  --header 'Authorization: Bearer TOKEN_CON_EMPRESA' \
  --header 'Content-Type: application/json' \
  --data '{"nombre":"Centro Histórico","activo":true}'
```

No se aceptan `empresaSlug`, `empresaId` ni `schemaName` en rutas o DTOs de sucursales. Las rutas antiguas `/api/empresas/:empresaSlug/sucursales` ya no existen y responden `404`.

`DELETE` realiza una baja lógica estableciendo `activo=false`; nunca elimina físicamente la sucursal. Los nombres son obligatorios y únicos, sin distinguir mayúsculas, dentro de cada empresa. Consultar desde un tenant el UUID de una sucursal de otro tenant responde `404`. La llave UUID de `sucursales` queda preparada para futuras relaciones desde vestidos y reservaciones dentro del mismo schema.

## Aislamiento de tenants

Sucursales es el primer módulo que utiliza el flujo reutilizable JWT → `TenantScope` → transacción. Los futuros módulos autenticados de vestidos y reservaciones pueden aplicar la misma abstracción:

1. `JwtAuthGuard` verifica firma, expiración, sesión y usuario, y deja los claims validados en la solicitud.
2. `TenantAuthGuard` lee `empresaId` exclusivamente de esos claims. Ignora headers personalizados, parámetros, query strings y cuerpos HTTP.
3. `TenantResolverService.resolveByEmpresaId()` consulta `public.empresas` y construye un `TenantScope` inmutable. El scope comprueba internamente que `schemaName` corresponde exactamente al UUID de la empresa.
4. `@CurrentTenant()` entrega el scope verificado al controlador o servicio; el cliente nunca conoce el schema.
5. `TenantContextService.run()` reserva una conexión del pool, inicia una transacción y ejecuta `SET LOCAL search_path TO <tenant>, pg_catalog`.
6. La operación recibe solamente un `EntityManager` ligado a esa transacción. `COMMIT` o `ROLLBACK` elimina el `search_path` local antes de devolver la conexión.
7. `TenantScopeCleanupInterceptor` elimina el scope request-local al completar o fallar la respuesta.

El decorador compuesto `@TenantAuthenticated()` aplica siempre los guards en el orden correcto y registra la limpieza:

```ts
@TenantAuthenticated()
@Get()
findAll(@CurrentTenant() tenant: TenantScope) {
  return this.tenantContext.run(tenant, async (manager) => {
    return manager.getRepository(TenantEntity).find();
  });
}
```

No se utiliza `SET search_path` de sesión ni se aceptan nombres de schema en headers, parámetros HTTP, query strings o DTOs. `public` tampoco se incluye como fallback dentro de una operación tenant: las consultas globales se resuelven antes, fuera del contexto tenant. `DB_POOL_MAX` permite ajustar el tamaño del pool sin cambiar este comportamiento.

### Pruebas PostgreSQL de aislamiento

Las suites crean empresas y sucursales temporales, permiten el mismo nombre en tenants distintos y fuerzan `DB_POOL_MAX=1` para comprobar que `search_path` vuelve a `public` al reutilizar la conexión. `test:auth-database` recorre las rutas HTTP con access tokens de dos empresas, comprueba el `404` cruzado, la baja lógica y que la ruta anterior por slug permanezca deshabilitada; `test:tenancy` verifica el aislamiento directamente en la capa de persistencia.

```bash
NODE_ENV=test \
DB_HOST=127.0.0.1 \
DB_PORT=5432 \
DB_USERNAME=tu_usuario \
DB_PASSWORD=tu_password \
DB_DATABASE=vestidos_saas \
DB_SSL=false \
DB_POOL_MAX=1 \
JWT_ACCESS_SECRET=un-secreto-de-pruebas-con-al-menos-32-bytes \
JWT_ACCESS_TTL_SECONDS=900 \
AUTH_REFRESH_TTL_SECONDS=2592000 \
npm run test:auth-database
```

Para la segunda suite, repite el mismo bloque sustituyendo la última línea por `npm run test:tenancy`.

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
npm run test:auth-database
npm run test:tenancy
```

Los scripts se ejecutan desde la raíz y delegan a cada workspace cuando corresponde.
