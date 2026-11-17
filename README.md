# Dresses SaaS

Base de un SaaS multi-tenant para negocios de renta de vestidos. El proyecto contiene una aplicación web, un API con autenticación JWT y la infraestructura local de PostgreSQL con TypeORM. El módulo de vestidos permite crear y consultar el catálogo; reservaciones todavía no está implementado.

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

La empresa, el schema y sus migrations se crean dentro de una sola transacción. Un fallo revierte todos los pasos y un slug repetido responde con HTTP `409`. Las migrations del tenant crean su tabla de control y las tablas `sucursales`, `vestidos` y `clientes`.

Verifica el registro y el schema desde `psql`:

```sql
SELECT id, nombre, slug, schema_name, activo FROM public.empresas;
SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%';
SELECT * FROM tenant_019a6f3382b77a22971b6a8d7c5e4f30.tenant_migrations;
```

### Aplicar migrations a tenants existentes

Los tenants nuevos reciben todas las migrations durante su creación. Para recorrer las empresas ya registradas y aplicar únicamente las migrations tenant pendientes, ejecuta desde la raíz:

```bash
npm run tenant:migration:run
```

El comando obtiene internamente los nombres de schema desde `public.empresas`, valida cada nombre con la convención segura del backend y usa un bloqueo transaccional por tenant. No recibe schemas desde argumentos del cliente y puede ejecutarse nuevamente sin duplicar migrations.

## Modelo tenant de clientes

Cada fila de `clientes` pertenece exclusivamente al schema de una empresa. No existe una tabla ni entidad de clientes en `public`.

| Campo                      | Tipo PostgreSQL | Regla principal                      |
| -------------------------- | --------------- | ------------------------------------ |
| `id`                       | `uuid`          | Llave primaria                       |
| `nombre`                   | `varchar(160)`  | Obligatorio y sin espacios laterales |
| `telefono`                 | `varchar(40)`   | Opcional                             |
| `email`                    | `varchar(254)`  | Opcional, almacenado en minúsculas   |
| `direccion`                | `varchar(255)`  | Opcional                             |
| `notas`                    | `varchar(2000)` | Opcional                             |
| `activo`                   | `boolean`       | `true` por defecto                   |
| `created_at`, `updated_at` | `timestamptz`   | Fechas administradas por TypeORM     |

Todo cliente debe tener al menos teléfono o email. La entidad elimina espacios laterales, convierte el email a minúsculas y transforma cadenas opcionales vacías en `null`. Las restricciones PostgreSQL impiden guardar nombres vacíos, contactos ausentes o valores sin normalizar mediante escritura directa.

Teléfono y email no son únicos: varias personas pueden compartirlos. La migration `CreateClientes1794956400000` crea índices no únicos para nombre y email normalizados, teléfono y el listado por `activo`, `createdAt` e `id`.

Los tenants nuevos reciben la tabla durante su creación. Para aplicarla a schemas existentes:

```bash
npm run tenant:migration:run
```

El UUID de `clientes` queda preparado para la futura relación `clienteId` de reservaciones. Todavía no existen endpoints, historial de rentas, documentos, imágenes ni deduplicación automática de clientes.

## Modelo tenant de vestidos

Cada fila de `vestidos` representa una pieza física individual y pertenece a una sucursal del mismo tenant. No existe una entidad de vestidos en `public` ni un inventario acumulado por modelo.

| Campo                      | Tipo PostgreSQL | Regla principal                              |
| -------------------------- | --------------- | -------------------------------------------- |
| `id`                       | `uuid`          | Llave primaria                               |
| `sucursal_id`              | `uuid`          | FK a `sucursales`, `ON DELETE RESTRICT`      |
| `codigo`                   | `varchar(50)`   | Único por empresa, sin distinguir mayúsculas |
| `nombre`                   | `varchar(160)`  | Obligatorio                                  |
| `descripcion`              | `varchar(1000)` | Opcional                                     |
| `talla`                    | `varchar(30)`   | Obligatorio                                  |
| `color`                    | `varchar(80)`   | Obligatorio                                  |
| `marca`                    | `varchar(100)`  | Opcional                                     |
| `precio_renta`             | `numeric(12,2)` | No negativo                                  |
| `deposito`                 | `numeric(12,2)` | Opcional y no negativo                       |
| `estado_operativo`         | `varchar(20)`   | `DISPONIBLE` o `MANTENIMIENTO`               |
| `activo`                   | `boolean`       | `true` por defecto                           |
| `created_at`, `updated_at` | `timestamptz`   | Fechas administradas por TypeORM             |

`estado_operativo=DISPONIBLE` indica que la pieza puede operar normalmente; no garantiza que esté libre para un rango de fechas. Esa disponibilidad se calculará posteriormente a partir de reservaciones.

La migration `CreateVestidos1794697200000` crea la tabla, la relación con sucursales, las restricciones monetarias y de estado y el índice único normalizado de código. `OptimizeVestidosCatalog1794783600000` añade índices compuestos para el orden paginado estable y los filtros por sucursal, activo y estado operativo. Ambas se aplican automáticamente a tenants nuevos; para schemas existentes se utiliza `npm run tenant:migration:run`.

### CRUD parcial de vestidos

Las operaciones disponibles son:

```text
POST   /api/vestidos
GET    /api/vestidos
GET    /api/vestidos/:id
PATCH  /api/vestidos/:id
DELETE /api/vestidos/:id
```

Crear, actualizar, trasladar, reactivar o desactivar requiere un access token con empresa seleccionada y una membresía `OWNER` activa. `EMPLOYEE` recibe `403` para esas operaciones, pero tanto `OWNER` como `EMPLOYEE` pueden consultar. Los cuerpos rechazan `empresaId`, `empresaSlug`, `schemaName` y cualquier campo desconocido.

Todas las rutas de vestidos aplican `JwtAuthGuard` → `TenantAuthGuard` → `RolesGuard` mediante `@TenantAuthenticated()`. El rol se obtiene de la membresía activa consultada durante la solicitud, no solamente del claim incluido en el JWT; desactivar la membresía o la empresa revoca el acceso inmediatamente.

Los DTOs estrictos aceptan:

- Creación: `sucursalId`, `codigo`, `nombre`, `descripcion`, `talla`, `color`, `marca`, `precioRenta`, `deposito` y `estadoOperativo`.
- Actualización: los mismos campos de forma parcial, además de `activo`; se exige al menos un campo.
- Listado: únicamente los filtros y parámetros de paginación descritos abajo.

El tenant nunca forma parte de esos DTOs. Los headers personalizados con empresa o schema no sustituyen la empresa verificada del JWT y se ignoran como fuente de autorización.

```bash
curl --request POST http://localhost:3000/api/vestidos \
  --header 'Authorization: Bearer TOKEN_OWNER_CON_EMPRESA' \
  --header 'Content-Type: application/json' \
  --data '{
    "sucursalId":"a18c2a56-d33f-4d88-a8e7-42931121e295",
    "codigo":"v-001",
    "nombre":"Vestido azul",
    "descripcion":"Corte largo",
    "talla":"M",
    "color":"Azul",
    "marca":"Marca ejemplo",
    "precioRenta":"1250.50",
    "deposito":"500.00",
    "estadoOperativo":"DISPONIBLE"
  }'
```

El backend normaliza `codigo` a mayúsculas, valida que la sucursal exista y esté activa dentro del tenant autenticado, y ejecuta la creación completa mediante `TenantContextService`. `estadoOperativo` es opcional y usa `DISPONIBLE` por defecto. Los importes aceptan texto decimal o número, se normalizan a dos decimales sin realizar cálculos de punto flotante y deben estar entre `0.00` y `9999999999.99`.

Un código repetido dentro de la empresa responde `409`, incluso ante solicitudes concurrentes; el mismo código puede existir en otra empresa. Una sucursal inexistente, inactiva o perteneciente a otro tenant responde `404`.

El listado acepta estos query parameters opcionales:

| Parámetro         | Regla                                                     |
| ----------------- | --------------------------------------------------------- |
| `page`            | Entero positivo; valor predeterminado `1`                 |
| `limit`           | Entero entre `1` y `100`; valor predeterminado `20`       |
| `sucursalId`      | UUID de una sucursal del tenant                           |
| `activo`          | Únicamente `true` o `false`                               |
| `estadoOperativo` | `DISPONIBLE` o `MANTENIMIENTO`                            |
| `q`               | Busca sin distinguir mayúsculas en código, nombre o marca |

```bash
curl 'http://localhost:3000/api/vestidos?page=1&limit=20&activo=true&q=azul' \
  --header 'Authorization: Bearer TOKEN_CON_EMPRESA'
```

Los resultados se ordenan de forma estable por `createdAt DESC` y devuelven:

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

Cada vestido incluye únicamente los datos básicos de su sucursal (`id`, `nombre` y `activo`), obtenidos en la misma consulta para evitar N+1. Nunca se exponen `schemaName` ni otros datos internos del tenant. Los parámetros desconocidos y los selectores `empresaId`, `empresaSlug` o `schemaName` se rechazan con `400`. Consultar un UUID inexistente o perteneciente a otro tenant responde `404`.

Actualizar, trasladar o reactivar una pieza:

```bash
curl --request PATCH http://localhost:3000/api/vestidos/ID \
  --header 'Authorization: Bearer TOKEN_OWNER_CON_EMPRESA' \
  --header 'Content-Type: application/json' \
  --data '{
    "sucursalId":"b28c2a56-d33f-4d88-a8e7-42931121e295",
    "codigo":"v-002",
    "precioRenta":"1500.00",
    "activo":true
  }'
```

Todos los campos editables del vestido son opcionales en `PATCH`, pero se requiere al menos uno. Cambiar `sucursalId` traslada la pieza únicamente si la sucursal destino pertenece al tenant autenticado y está activa. El código se vuelve a normalizar y conserva su unicidad por empresa; un conflicto responde `409`.

```bash
curl --request DELETE http://localhost:3000/api/vestidos/ID \
  --header 'Authorization: Bearer TOKEN_OWNER_CON_EMPRESA'
```

`DELETE` realiza exclusivamente una baja lógica con `activo=false`; el registro permanece en la tabla y puede reactivarse con `PATCH`. Todas las mutaciones se ejecutan en una transacción tenant. Un vestido inexistente o de otro tenant responde `404`.

| Operación  | OWNER     | EMPLOYEE  |
| ---------- | --------- | --------- |
| Crear      | Permitido | 403       |
| Listar     | Permitido | Permitido |
| Consultar  | Permitido | Permitido |
| Actualizar | Permitido | 403       |
| Trasladar  | Permitido | 403       |
| Activar    | Permitido | 403       |
| Desactivar | Permitido | 403       |

El historial de movimientos, la auditoría, las imágenes, las reservaciones y la disponibilidad por fechas quedan fuera de este alcance.

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

### Matriz de permisos

| Operación                         | OWNER     | EMPLOYEE  |
| --------------------------------- | --------- | --------- |
| Listar sucursales                 | Permitido | Permitido |
| Consultar una sucursal            | Permitido | Permitido |
| Crear una sucursal                | Permitido | 403       |
| Actualizar o activar una sucursal | Permitido | 403       |
| Desactivar una sucursal           | Permitido | 403       |

`@Roles()` declara los roles permitidos en cada endpoint y `RolesGuard` aplica la autorización. El guard utiliza exclusivamente la membresía activa obtenida desde `public.empresa_usuarios` durante la solicitud; no autoriza con el rol incluido en el JWT. Por ello, un cambio de rol o la desactivación de la membresía o empresa se aplica inmediatamente y responde `403` aun cuando el access token todavía no haya expirado. Un usuario inactivo invalida su token y recibe `401`. Un recurso inexistente o perteneciente a otro tenant conserva la respuesta `404`.

## Aislamiento de tenants

Sucursales y vestidos utilizan el flujo reutilizable JWT → `TenantScope` → transacción. Los futuros módulos autenticados, como reservaciones, pueden aplicar la misma abstracción:

1. `JwtAuthGuard` verifica firma, expiración, sesión y usuario, y deja los claims validados en la solicitud.
2. `TenantAuthGuard` lee `empresaId` exclusivamente de esos claims. Ignora headers personalizados, parámetros, query strings y cuerpos HTTP.
3. El mismo guard consulta la membresía por `sub` y `empresaId`, exigiendo usuario, membresía y empresa activos; el rol vigente de esa membresía queda disponible únicamente dentro de la solicitud.
4. `TenantResolverService.resolveByEmpresaId()` consulta `public.empresas` y construye un `TenantScope` inmutable. El scope comprueba internamente que `schemaName` corresponde exactamente al UUID de la empresa.
5. `RolesGuard` compara el rol de la membresía verificada con los declarados mediante `@Roles()`; nunca toma la decisión usando solamente el rol del JWT.
6. `@CurrentTenant()` entrega el scope verificado al controlador o servicio; el cliente nunca conoce el schema.
7. `TenantContextService.run()` reserva una conexión del pool, inicia una transacción y ejecuta `SET LOCAL search_path TO <tenant>, pg_catalog`.
8. La operación recibe solamente un `EntityManager` ligado a esa transacción. `COMMIT` o `ROLLBACK` elimina el `search_path` local antes de devolver la conexión.
9. `TenantScopeCleanupInterceptor` elimina el scope y la membresía request-local al completar o fallar la respuesta.

El decorador compuesto `@TenantAuthenticated()` aplica siempre los guards en el orden correcto y registra la limpieza:

```ts
@TenantAuthenticated()
@Get()
@Roles(EmpresaUsuarioRol.OWNER, EmpresaUsuarioRol.EMPLOYEE)
findAll(@CurrentTenant() tenant: TenantScope) {
  return this.tenantContext.run(tenant, async (manager) => {
    return manager.getRepository(TenantEntity).find();
  });
}
```

No se utiliza `SET search_path` de sesión ni se aceptan nombres de schema en headers, parámetros HTTP, query strings o DTOs. `public` tampoco se incluye como fallback dentro de una operación tenant: las consultas globales se resuelven antes, fuera del contexto tenant. `DB_POOL_MAX` permite ajustar el tamaño del pool sin cambiar este comportamiento.

### Pruebas PostgreSQL de aislamiento

Las suites crean empresas, sucursales y vestidos temporales, permiten los mismos nombres y códigos en tenants distintos y fuerzan `DB_POOL_MAX=1` para comprobar que `search_path` vuelve a `public` al reutilizar la conexión. `test:auth-database` recorre las rutas HTTP con access tokens OWNER y EMPLOYEE, comprueba las consultas del catálogo, los `403` por rol o membresía/empresa inactiva, los `404` cruzados, la baja lógica y que la ruta anterior por slug permanezca deshabilitada; `test:tenancy` verifica directamente en PostgreSQL la paginación, los filtros, la búsqueda, las migrations tenant y el aislamiento de persistencia.

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
