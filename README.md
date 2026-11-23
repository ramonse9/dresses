# Dresses SaaS

Base de un SaaS multi-tenant para negocios de renta de vestidos. El proyecto contiene una aplicación web, un API con autenticación JWT y la infraestructura local de PostgreSQL con TypeORM. Incluye clientes, catálogo, disponibilidad y reservaciones con ciclo de vida controlado, aisladas por tenant.

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
CORS_ALLOWED_ORIGINS=http://localhost:4200,http://127.0.0.1:4200
TRUST_PROXY=false
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

La autenticación identifica al usuario y permite seleccionar una empresa únicamente por `empresaId`; el backend valida la membresía y mantiene `schemaName` como información interna. El módulo `EmpresasModule` usa repositorios parametrizados de TypeORM y nunca acepta identificadores SQL desde el cliente.

## Usuarios y membresías

Los usuarios y sus accesos a empresas son información global y viven exclusivamente en `public`:

- `public.usuarios`: UUID, email, `password_hash`, nombre, estado y timestamps.
- `public.empresa_usuarios`: relación entre usuario y empresa, rol, estado y fecha de creación.
- Roles iniciales: `OWNER` y `EMPLOYEE`.
- Un usuario solo puede tener una membresía por empresa.

El email se normaliza con `trim().toLowerCase()` antes de persistir. PostgreSQL exige además que el valor almacenado esté en minúsculas y mantiene un índice único. `passwordHash` tiene `select: false` en TypeORM y `Usuario.toJSON()` utiliza una lista explícita de campos públicos, por lo que el hash no aparece en consultas normales ni serializaciones.

`UsuariosModule` exporta servicios de consulta para buscar usuarios activos y membresías activas. No existen endpoints de usuarios ni registro público. Las credenciales tampoco se almacenan dentro de schemas tenant.

La migration global correspondiente es `CreateUsuariosMemberships1794442297164` y crea las llaves foráneas hacia `public.usuarios` y `public.empresas` con eliminación restringida.

Las sesiones también son globales y viven en `public.auth_sessions`. Cada registro pertenece a un usuario y contiene únicamente el hash del refresh token, su expiración, metadata técnica acotada y el momento opcional de revocación. Las migrations `CreateAuthSessions1794528000000` y `AddAuthSessionMetadata1795734000000` crean y amplían esta tabla; `synchronize` permanece deshabilitado.

### Consulta administrativa de miembros

Un `OWNER` puede consultar las membresías de la empresa seleccionada sin cambiar el `search_path`, porque `EmpresaUsuario` y `Usuario` pertenecen explícitamente a `public`:

```text
GET /api/equipo/miembros
GET /api/equipo/miembros/:id
```

Ambas rutas usan `JwtAuthGuard`, `TenantAuthGuard` y `RolesGuard`. El alcance se obtiene exclusivamente de `TenantScope.empresaId`; los parámetros `empresaId`, `empresaSlug`, `schemaName` y `usuarioId` son rechazados y los headers personalizados de tenant no modifican el contexto verificado. `EMPLOYEE` recibe `403` y una membresía de otra empresa responde `404`.

El listado admite `page`, `limit` —con máximo de 100—, `rol`, `activo` y `q` por nombre o email. Utiliza el orden estable `createdAt DESC, id DESC` y el formato paginado estándar:

```bash
curl 'http://localhost:3000/api/equipo/miembros?page=1&limit=20&rol=EMPLOYEE&activo=true&q=ana' \
  --header 'Authorization: Bearer eyJ...'
```

```json
{
  "data": [
    {
      "id": "818c2a56-d33f-4d88-a8e7-42931121e295",
      "usuario": {
        "id": "019a6f33-82b7-7a22-971b-6a8d7c5e4f30",
        "nombre": "Ana López",
        "email": "ana@example.com",
        "activo": true
      },
      "rol": "EMPLOYEE",
      "activo": true,
      "createdAt": "2026-11-20T12:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

La respuesta se construye mediante una proyección explícita y nunca incluye `passwordHash`, sesiones, hashes de refresh, nombres de schemas ni membresías del mismo usuario en otras empresas.

### Administración de membresías

Un `OWNER` puede modificar exclusivamente el rol o el estado de una membresía existente de su empresa:

```text
PATCH /api/equipo/miembros/:id/rol
PATCH /api/equipo/miembros/:id/estado
```

| Operación                   | OWNER     | EMPLOYEE |
| --------------------------- | --------- | -------- |
| Consultar miembros          | Permitido | 403      |
| Cambiar `OWNER`/`EMPLOYEE`  | Permitido | 403      |
| Activar o desactivar acceso | Permitido | 403      |

Los cuerpos son estrictos y aceptan exactamente un campo:

```bash
curl --request PATCH http://localhost:3000/api/equipo/miembros/ID_MEMBRESIA/rol \
  --header 'Authorization: Bearer TOKEN_CON_EMPRESA' \
  --header 'Content-Type: application/json' \
  --data '{"rol":"EMPLOYEE"}'

curl --request PATCH http://localhost:3000/api/equipo/miembros/ID_MEMBRESIA/estado \
  --header 'Authorization: Bearer TOKEN_CON_EMPRESA' \
  --header 'Content-Type: application/json' \
  --data '{"activo":false}'
```

El backend obtiene `empresaId` del `TenantScope` verificado; nunca acepta selectores de tenant ni modifica `Usuario`, contraseñas, sesiones o membresías de otras empresas. Una desactivación retira inmediatamente el acceso a esa empresa, pero conserva las demás sesiones y membresías del usuario. La reactivación exige que tanto el usuario global como la empresa continúen activos.

Toda mutación se ejecuta en una transacción sobre `public`. El servicio bloquea primero la fila de `Empresa` y después la de `EmpresaUsuario`, vuelve a contar las membresías `OWNER` activas cuyos usuarios globales también estén activos y responde `409` si la operación dejaría a la empresa sin propietario efectivo. Este orden serializa los cambios de una misma empresa y protege al último `OWNER` incluso ante solicitudes concurrentes. Un `OWNER` puede desactivar su propia membresía únicamente cuando permanece otro `OWNER` activo.

Todavía no se crean usuarios ni invitaciones desde estas rutas.

### Modelo global de invitaciones

Las invitaciones a empresas se almacenan exclusivamente en `public.empresa_invitaciones`; no existe una tabla equivalente dentro de los schemas tenant. Cada registro conserva:

- empresa, email normalizado y rol `OWNER` o `EMPLOYEE`;
- hash SHA-256 del token, expiración y datos de envío;
- usuario creador y usuario que aceptó, cuando corresponda;
- timestamps de aceptación, revocación, creación y actualización.

El token original nunca se persiste. `token_hash` exige exactamente 64 caracteres hexadecimales en minúsculas, tiene un índice único, utiliza `select: false` en TypeORM y se omite de `toJSON()`. Las relaciones con empresa, usuario creador y usuario aceptante utilizan `ON DELETE RESTRICT`.

El estado no se duplica en una columna. Se deriva de los timestamps:

| Estado derivado | Condición                                         |
| --------------- | ------------------------------------------------- |
| `PENDIENTE`     | No fue aceptada ni revocada y todavía no expira   |
| `ACEPTADA`      | `acceptedAt` tiene valor                          |
| `REVOCADA`      | No fue aceptada y `revokedAt` tiene valor         |
| `EXPIRADA`      | No fue aceptada ni revocada y `expiresAt` ya pasó |

Una invitación solamente es utilizable cuando está pendiente y la empresa sigue activa. El índice único parcial por empresa y email impide dos invitaciones sin aceptar ni revocar simultáneamente. Una invitación expirada continúa ocupando esa restricción hasta que el flujo futuro la marque como revocada. `sendCount` debe ser no negativo.

La migration pública es `CreateEmpresaInvitaciones1795561200000` y se ejecuta con las migrations normales:

```bash
npm run migration:show
npm run migration:run
```

La prueba PostgreSQL crea y elimina una base aislada para comprobar una instalación nueva, `down` y reaplicación sobre una base existente. El usuario de pruebas necesita permiso `CREATEDB`:

```bash
npm run test:auth-database
```

### Modelo global de recuperación de contraseña

Los tokens de recuperación se almacenan exclusivamente en `public.password_reset_tokens`; no existe una tabla equivalente en los schemas tenant. Cada registro conserva el usuario, el hash SHA-256 del token, su expiración y los timestamps opcionales de uso o revocación. `public.usuarios.password_changed_at` registra cuándo cambió la contraseña por última vez y permanece en `null` hasta que un flujo futuro complete el cambio.

El token original nunca se persiste ni se serializa. `token_hash` exige 64 caracteres hexadecimales en minúsculas, tiene un índice único y está configurado con `select: false` en TypeORM. La relación con `Usuario` utiliza `ON DELETE CASCADE`, por lo que los tokens dejan de existir si se elimina físicamente el usuario global.

El estado se deriva sin guardar una columna adicional:

| Estado derivado | Condición                                      |
| --------------- | ---------------------------------------------- |
| `PENDIENTE`     | No fue usado ni revocado y aún no ha expirado  |
| `USADO`         | `usedAt` tiene valor                           |
| `REVOCADO`      | No fue usado y `revokedAt` tiene valor         |
| `EXPIRADO`      | No fue usado ni revocado y `expiresAt` ya pasó |

Un token solamente es utilizable si está pendiente y el usuario global continúa activo. Un índice único parcial impide más de un token sin usar ni revocar por usuario. Por diseño, un token expirado continúa ocupando esa restricción hasta que el futuro flujo de solicitud lo marque como revocado antes de emitir el reemplazo.

La migration pública es `CreatePasswordResetTokens1795647600000` y se administra con las migrations normales:

```bash
npm run migration:show
npm run migration:run
npm run migration:revert
```

La validación PostgreSQL crea una base temporal, aplica todas las migrations públicas, revierte y reaplica la migration nueva, comprueba sus restricciones e índices y elimina la base al terminar:

```bash
npm run test:auth-database
```

### Recuperación de contraseña

El flujo público utiliza dos endpoints protegidos por `AuthOriginGuard` y políticas independientes de rate limiting:

```text
POST /api/auth/password/solicitar
POST /api/auth/password/restablecer
```

Solicita un correo enviando únicamente el email:

```bash
curl --request POST http://localhost:3000/api/auth/password/solicitar \
  --header 'Content-Type: application/json' \
  --data '{"email":"usuario@example.com"}'
```

La solicitud responde siempre con HTTP `202` y el mismo mensaje, sin revelar si la cuenta existe, está inactiva, se encuentra dentro del cooldown o falló temporalmente el envío. Solamente los usuarios activos reciben un token. El backend revoca tokens anteriores, genera 256 bits aleatorios, persiste únicamente su hash SHA-256 y construye internamente una URL con fragmento:

```text
WEB_APP_URL/restablecer-password#token=<token-opaco>
```

Si el proveedor de correo falla, el token que no pudo entregarse se revoca y la respuesta pública permanece genérica. Ni el token ni la URL completa se registran o devuelven en JSON.

Para completar el cambio:

```bash
curl --request POST http://localhost:3000/api/auth/password/restablecer \
  --header 'Content-Type: application/json' \
  --data '{"token":"TOKEN_OPACO","password":"nueva-contraseña-segura"}'
```

El token se busca por hash y se bloquea dentro de una transacción sobre `public`. La operación exige un usuario activo y un token vigente, no usado y no revocado. La contraseña nueva no puede coincidir con la actual; se guarda con Argon2id y se actualiza `passwordChangedAt`. En la misma transacción se marca `usedAt`, se revocan los demás tokens de recuperación y todas las filas de `AuthSession` del usuario. Por ello, los access y refresh tokens emitidos antes del cambio dejan de funcionar inmediatamente. El flujo no inicia una nueva sesión.

Configuración:

```dotenv
PASSWORD_RESET_TTL_SECONDS=3600
PASSWORD_RESET_REQUEST_COOLDOWN_SECONDS=300
AUTH_RATE_LIMIT_RECOVERY_REQUEST_LIMIT=3
AUTH_RATE_LIMIT_RECOVERY_REQUEST_WINDOW_SECONDS=900
AUTH_RATE_LIMIT_PASSWORD_RESET_LIMIT=5
AUTH_RATE_LIMIT_PASSWORD_RESET_WINDOW_SECONDS=900
WEB_APP_URL=http://localhost:4200
```

`PASSWORD_RESET_TTL_SECONDS` admite de 5 minutos a 24 horas. El cooldown admite de 1 segundo a 24 horas. Los cuerpos son estrictos y rechazan campos como `empresaId`, `rol` o `schemaName`.

El frontend expone dos rutas públicas lazy-loaded:

```text
/olvide-password
/restablecer-password
```

El login enlaza a `/olvide-password`. Su formulario normaliza el email a minúsculas, bloquea envíos duplicados y presenta siempre el mensaje genérico devuelto por el backend. Un `429` muestra el tiempo de espera indicado por `Retry-After` sin revelar información sobre la cuenta.

`/restablecer-password` obtiene el token exclusivamente desde `#token=...`, limpia inmediatamente el fragmento de la barra de direcciones y conserva el valor solo en memoria. Solicita contraseña y confirmación local, pero envía al API únicamente token y contraseña. Después del éxito limpia formulario y token, navega a `/login` y muestra que las sesiones anteriores fueron cerradas. Los endpoints públicos de recuperación están excluidos del interceptor JWT y nunca provocan un refresh automático.

### Emisión y administración de invitaciones

Las invitaciones son operaciones administrativas disponibles exclusivamente para `OWNER`:

```text
POST   /api/equipo/invitaciones
GET    /api/equipo/invitaciones
POST   /api/equipo/invitaciones/:id/reenviar
DELETE /api/equipo/invitaciones/:id
```

Todas las rutas usan `JwtAuthGuard`, `TenantAuthGuard` y `RolesGuard`. La empresa y el rol se obtienen de la membresía vigente; los DTOs no aceptan `empresaId`, `empresaSlug`, `schemaName`, tokens ni hashes.

Crear una invitación requiere únicamente email y rol:

```bash
curl --request POST http://localhost:3000/api/equipo/invitaciones \
  --header 'Authorization: Bearer TOKEN_CON_EMPRESA' \
  --header 'Content-Type: application/json' \
  --data '{"email":"persona@example.com","rol":"EMPLOYEE"}'
```

El backend normaliza el email, vuelve a comprobar que la empresa y el `OWNER` continúen activos, rechaza membresías activas e invitaciones vigentes con `409`, y revoca automáticamente una invitación expirada antes de crear su reemplazo.

El token contiene 256 bits aleatorios. Solamente su SHA-256 se guarda en PostgreSQL y la URL se construye internamente con un fragmento:

```text
https://app.example.com/aceptar-invitacion#token=TOKEN
```

El fragmento evita que el token se envíe al servidor web durante la navegación inicial. Ni el token ni la URL aparecen en respuestas, excepciones o logs.

La expiración y el cooldown se configuran en segundos:

```env
INVITATION_TTL_SECONDS=604800
INVITATION_RESEND_COOLDOWN_SECONDS=300
```

El correo se envía después de confirmar la persistencia. `lastSentAt` y `sendCount` se actualizan únicamente después de una entrega exitosa. Si el proveedor falla, el API responde `503`, conserva la invitación con un hash seguro y permite usar posteriormente el endpoint de reenvío.

Reenviar genera un token nuevo, sustituye el hash antes de enviar, invalida el token anterior, renueva `expiresAt` y responde `429` durante el cooldown. Revocar establece `revokedAt` sin eliminar el registro; una invitación aceptada responde `409`.

El listado acepta `page`, `limit`, `estado`, `rol` y `q` por email:

```bash
curl 'http://localhost:3000/api/equipo/invitaciones?page=1&limit=20&estado=PENDIENTE&rol=EMPLOYEE&q=persona' \
  --header 'Authorization: Bearer TOKEN_CON_EMPRESA'
```

La creación bloquea la empresa dentro de una transacción para serializar comprobaciones por email. Reenvío y revocación utilizan un lock advisory interno y estable por empresa–invitación, además del bloqueo de fila; ninguna clave de lock proviene del cliente.

### Verificación y aceptación de invitaciones

La pantalla pública obtiene el token del fragmento de la URL y lo envía explícitamente al API. Los endpoints no requieren JWT, pero usan `AuthOriginGuard` y políticas de rate limit independientes:

```text
POST /api/auth/invitaciones/verificar
POST /api/auth/invitaciones/aceptar
```

La verificación recibe exclusivamente el token opaco:

```bash
curl --request POST http://localhost:3000/api/auth/invitaciones/verificar \
  --header 'Content-Type: application/json' \
  --data '{"token":"TOKEN_DE_LA_INVITACION"}'
```

Un token válido devuelve solamente el nombre de la empresa, el email enmascarado, el rol, `expiresAt` y `accountExists`. Los tokens inválidos, expirados, revocados, aceptados o asociados a una empresa inactiva producen el mismo error genérico. Nunca se devuelven identificadores internos, hashes o nombres de schemas.

Para una cuenta nueva se requiere nombre y una contraseña de entre 8 y 1024 caracteres:

```bash
curl --request POST http://localhost:3000/api/auth/invitaciones/aceptar \
  --header 'Content-Type: application/json' \
  --data '{"token":"TOKEN_DE_LA_INVITACION","nombre":"Ana López","password":"contraseña-segura"}'
```

El backend crea el usuario con Argon2id y la membresía con el rol guardado en la invitación. Si el email ya corresponde a una cuenta global activa, `nombre` no es necesario: `password` debe ser la contraseña actual y el perfil no se modifica. Una membresía inactiva se reactiva con el rol de la invitación; una membresía ya activa responde `409`.

La aceptación bloquea primero la empresa y después la invitación dentro de una única transacción de `public`. Un lock transaccional interno por email serializa la creación global del usuario. Solamente una solicitud concurrente puede consumir el token; cualquier error revierte usuario, membresía y aceptación. El endpoint no crea una sesión ni devuelve tokens JWT: al terminar, la persona debe usar `/api/auth/login`.

El frontend ofrece la ruta pública `/aceptar-invitacion`, sin requerir autenticación ni una empresa seleccionada. La pantalla consume el token exclusivamente desde `#token=...`, reemplaza inmediatamente la URL para retirar el fragmento y conserva el valor solamente en memoria durante el flujo. No lo escribe en `localStorage`, `sessionStorage`, IndexedDB o cookies controladas por JavaScript. Los endpoints públicos de invitación están excluidos del interceptor JWT, por lo que tampoco reciben `Authorization` ni activan refresh ante un `401`.

Después de verificar, la pantalla muestra únicamente empresa, email enmascarado, rol y expiración. Una cuenta nueva captura nombre, contraseña y confirmación local; la confirmación nunca se envía al API. Una cuenta existente solicita solamente la contraseña actual. Al completar la aceptación se limpian token, formulario y datos verificados, se muestra una confirmación y se ofrece navegación a `/login`, sin iniciar sesión automáticamente.

### Administración de equipo en Angular

El frontend expone el feature lazy-loaded en `/app/equipo`, con listado filtrable y detalle administrativo. El listado conserva `page`, `limit`, `rol`, `activo` y `q` en los query parameters, aplica debounce a la búsqueda e ignora respuestas obsoletas. Su store está registrado en `TenantResetRegistry`, por lo que listado, detalle y solicitudes pendientes se limpian al cambiar de empresa.

La navegación y los controles se muestran según esta matriz visual:

| Acción                             | OWNER     | EMPLOYEE |
| ---------------------------------- | --------- | -------- |
| Ver enlace de Equipo               | Permitido | Oculto   |
| Consultar listado y detalle        | Permitido | 403 API  |
| Cambiar rol                        | Permitido | Oculto   |
| Activar o desactivar una membresía | Permitido | Oculto   |

La interfaz solicita confirmación antes de degradar un `OWNER`, desactivar una membresía o modificar la membresía propia. Un `409` se presenta como protección del último propietario, mientras que `403` y `404` se mantienen diferenciados. Después de cada mutación, el store vuelve a consultar el registro autoritativo. La ocultación visual no sustituye los guards ni la autorización del API.

La pestaña `Invitaciones`, disponible en `/app/equipo/invitaciones`, también se muestra exclusivamente a `OWNER`. Conserva `page`, `limit`, `estado`, `rol` y `q` en la URL, aplica debounce a la búsqueda y presenta los estados derivados `PENDIENTE`, `EXPIRADA`, `ACEPTADA` y `REVOCADA`. Cada registro muestra email, rol, expiración, último envío y cantidad de envíos; la respuesta se proyecta a un modelo visual que descarta cualquier campo ajeno a este contrato.

El formulario normaliza el email antes de validarlo y permite invitar como `OWNER` o `EMPLOYEE`. Reenviar y revocar requieren confirmación explícita: la interfaz aclara que reenviar invalida el enlace anterior y que revocar impide utilizarlo. Tras cada operación se vuelve a consultar el listado conservando filtros y página. Los errores `403`, `409`, `429` y `503` tienen mensajes diferenciados sin mostrar detalles internos. `TeamInvitationsStore` está registrado en `TenantResetRegistry`, por lo que las solicitudes y datos se eliminan al cambiar de empresa.

## Correo transaccional

`MailModule` ofrece una infraestructura independiente de autenticación y usuarios. Los consumidores internos dependen de `TransactionalMailService` o del token `MAIL_TRANSPORT`; no conocen Nodemailer ni la configuración SMTP. Las invitaciones y la recuperación de contraseña utilizan esta infraestructura.

Configuración local segura:

```env
MAIL_MODE=disabled
MAIL_HOST=smtp.example.com
MAIL_PORT=587
MAIL_SECURE=false
MAIL_USERNAME=change_me
MAIL_PASSWORD=change_me
MAIL_FROM=Vestidos SaaS <no-reply@example.com>
WEB_APP_URL=http://localhost:4200
```

`MAIL_MODE=disabled` es válido fuera de producción. Si algún servicio intenta enviar, recibe `MailDisabledError`; el contenido, las URLs y posibles tokens no se imprimen. En producción se exige `MAIL_MODE=smtp` y todas las variables SMTP. `WEB_APP_URL` debe ser exclusivamente un origen HTTP(S), sin comodines, credenciales, rutas, query strings ni fragmentos.

El remitente se toma siempre de `MAIL_FROM`; la entrada de `TransactionalMailService` no permite seleccionar remitente, host, credenciales, templates o rutas. Los futuros templates deben vivir dentro del backend y escapar cada valor dinámico con `escapeMailHtml()` antes de insertarlo en HTML. Ningún error de transporte conserva mensajes del proveedor que puedan incluir secretos.

Para pruebas puede sustituirse el transporte sin SMTP:

```ts
const testingModule = await Test.createTestingModule({
  imports: [MailModule],
})
  .overrideProvider(MAIL_TRANSPORT)
  .useValue(new InMemoryMailTransport())
  .compile();
```

`InMemoryMailTransport` conserva mensajes solamente en memoria y permite limpiarlos entre casos. En producción, el provider interno crea el transporte Nodemailer con la configuración validada.

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
  --cookie-jar cookies.txt \
  --data '{"email":"owner@example.com","password":"tu-password"}'
```

La respuesta JSON contiene únicamente el access token de corta duración:

```json
{
  "accessToken": "eyJ...",
  "tokenType": "Bearer",
  "expiresIn": 900
}
```

### Protección contra abuso

Los endpoints públicos de autenticación cuentan con políticas independientes de rate limiting. En este paso solamente `POST /api/auth/login` aplica su política; las demás quedan preparadas para los flujos posteriores de invitaciones y recuperación de contraseña. `refresh`, las rutas autenticadas y las rutas tenant no consumen la ventana de login.

| Política                       | Límite predeterminado | Ventana predeterminada |
| ------------------------------ | --------------------: | ---------------------: |
| Login                          |                     5 |            60 segundos |
| Verificación de invitación     |                    20 |            60 segundos |
| Aceptación de invitación       |                     5 |           300 segundos |
| Solicitud de recuperación      |                     3 |           900 segundos |
| Restablecimiento de contraseña |                     5 |           900 segundos |

Cada política se configura de forma independiente:

```env
AUTH_RATE_LIMIT_LOGIN_LIMIT=5
AUTH_RATE_LIMIT_LOGIN_WINDOW_SECONDS=60
AUTH_RATE_LIMIT_INVITATION_VERIFICATION_LIMIT=20
AUTH_RATE_LIMIT_INVITATION_VERIFICATION_WINDOW_SECONDS=60
AUTH_RATE_LIMIT_INVITATION_ACCEPTANCE_LIMIT=5
AUTH_RATE_LIMIT_INVITATION_ACCEPTANCE_WINDOW_SECONDS=300
AUTH_RATE_LIMIT_RECOVERY_REQUEST_LIMIT=3
AUTH_RATE_LIMIT_RECOVERY_REQUEST_WINDOW_SECONDS=900
AUTH_RATE_LIMIT_PASSWORD_RESET_LIMIT=5
AUTH_RATE_LIMIT_PASSWORD_RESET_WINDOW_SECONDS=900
TRUST_PROXY=false
```

Al exceder un límite, el API responde `429` con un mensaje genérico e incluye `Retry-After` en segundos. La clave interna se deriva de `request.ip`, el endpoint y la política; nunca incorpora contraseñas, tokens, cookies, cuerpos, nombres de schema ni headers de autenticación.

Express no confía en `X-Forwarded-For` de forma predeterminada. Mantén `TRUST_PROXY=false` al acceder directamente al API. Configura `TRUST_PROXY=true` solamente cuando la aplicación esté detrás de un proxy controlado que reemplace correctamente ese header; así `request.ip` puede representar al cliente real. `AuthOriginGuard` continúa validando el origen del navegador y admite clientes no navegador sin header `Origin`.

El almacenamiento inicial del rate limiter es local al proceso. Si el API se despliega con varias réplicas, debe sustituirse por un almacenamiento compartido compatible antes de considerar los límites globales entre instancias.

El JWT inicial contiene `sub`, `email` y un `sessionId` aleatorio, además de los timestamps estándar del token. No contiene `schemaName`, empresa ni membresía. El access token nunca se almacena en una cookie.

El refresh token contiene 256 bits aleatorios, no es un JWT y se entrega exclusivamente mediante la cookie `vestidos_refresh`. La cookie utiliza `HttpOnly`, `SameSite=Lax`, `Path=/api/auth`, un `Max-Age` igual a `AUTH_REFRESH_TTL_SECONDS` y `Secure` únicamente en producción. JavaScript no puede leerla y el navegador no la envía a las rutas de negocio. La base de datos guarda solamente su hash SHA-256; ni cookies, tokens completos ni contraseñas se registran.

Usa el cookie jar para obtener un access token nuevo. El endpoint no acepta body ni un campo `refreshToken`:

```bash
curl --request POST http://localhost:3000/api/auth/refresh \
  --cookie cookies.txt \
  --cookie-jar cookies.txt
```

Cada refresh rota el token dentro de una transacción con bloqueo de fila, reemplaza la cookie y devuelve solamente el access token nuevo. El hash anterior se sustituye antes de confirmar la transacción, por lo que el token anterior deja de funcionar inmediatamente. La fecha de expiración absoluta de la sesión no se extiende al rotar.

### Metadata de sesiones

Al crear una sesión durante el login, `public.auth_sessions` conserva `ip_address`, un `user_agent` saneado de hasta 512 caracteres y `last_seen_at`. El IP utiliza el tipo PostgreSQL `inet`; tanto el IP como el user-agent pueden ser `null`. `last_seen_at` se inicializa al crear la sesión y solamente se actualiza al rotar correctamente el refresh token, no en cada petición protegida. Las sesiones anteriores a la migration reciben como valor inicial su `updated_at`, o `created_at` como respaldo.

El IP siempre proviene de `request.ip`. Con `TRUST_PROXY=false`, un header `X-Forwarded-For` enviado directamente por un cliente no se considera. `TRUST_PROXY=true` debe habilitarse únicamente detrás de un proxy controlado que reemplace ese header. La aplicación extrae solamente estos dos campos: no persiste cookies, tokens, `Authorization`, contraseñas ni cuerpos HTTP como metadata.

Cuando una sesión se revoca por logout o por cambio de contraseña, `revoked_by_usuario_id` registra al usuario que originó la revocación. La relación usa `ON DELETE SET NULL`, mientras la relación principal sesión–usuario conserva su borrado en cascada. `refresh_token_hash` continúa con `select: false` y nunca aparece en la serialización.

### Administración de sesiones propias

Las rutas de administración son globales para el usuario autenticado: requieren `JwtAuthGuard`, pero no una empresa seleccionada ni `TenantAuthGuard`.

```text
GET    /api/auth/sessions
DELETE /api/auth/sessions/:id
POST   /api/auth/sessions/revocar-otras
```

El listado devuelve por defecto hasta 50 sesiones no revocadas, con un máximo configurable por solicitud de 100 mediante `limit`. `revoked=true` consulta solamente sesiones revocadas y `revoked=false` mantiene el comportamiento predeterminado. Cualquier otro query parameter, incluidos selectores tenant, se rechaza. El orden es `lastSeenAt DESC, id DESC`.

```bash
curl 'http://localhost:3000/api/auth/sessions?revoked=false&limit=50' \
  --header 'Authorization: Bearer eyJ...'
```

Cada elemento contiene exclusivamente `id`, `current`, `createdAt`, `lastSeenAt`, `expiresAt`, `revokedAt`, `ipAddress` y `userAgent`. No incluye hashes, usuario revocador, empresa, tenant ni schema. `current` se calcula comparando el identificador con el `sessionId` del JWT verificado.

Para revocar una sesión concreta:

```bash
curl --request DELETE \
  http://localhost:3000/api/auth/sessions/47ecf96a-8f2c-4e07-bd1f-93936f2cdb90 \
  --header 'Authorization: Bearer eyJ...'
```

La operación solamente encuentra sesiones del usuario autenticado; un UUID ajeno responde `404`. Es idempotente para una sesión propia ya revocada. Si el UUID corresponde a la sesión actual, también se elimina la cookie refresh y el access token deja de funcionar en la siguiente petición. Revocar una sesión remota no altera la cookie ni la sesión desde la que se ejecuta la acción.

Para cerrar todas las demás sesiones sin afectar la actual:

```bash
curl --request POST http://localhost:3000/api/auth/sessions/revocar-otras \
  --header 'Authorization: Bearer eyJ...' \
  --header 'Content-Type: application/json' \
  --data '{}'
```

La respuesta es `{ "revokedCount": 2 }`. A diferencia de `logout`, que revoca exclusivamente la sesión actual y elimina su cookie, esta operación conserva la sesión actual y revoca transaccionalmente todas las demás sesiones activas del usuario.

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
  --header 'Authorization: Bearer eyJ...' \
  --cookie cookies.txt \
  --cookie-jar cookies.txt
```

`logout` revoca la sesión, elimina la cookie y responde con HTTP `204` sin tokens. El guard JWT consulta la sesión en `public` en cada petición protegida, por lo que una sesión revocada o expirada, o perteneciente a un usuario inactivo, deja de aceptar incluso access tokens que aún no hayan vencido. El endpoint de refresh aplica las mismas verificaciones.

Puedes inspeccionar las sesiones sin exponer tokens completos:

```sql
SELECT id, usuario_id, ip_address, user_agent, last_seen_at,
       expires_at, revoked_at, revoked_by_usuario_id, created_at, updated_at
FROM public.auth_sessions;
```

La prueba PostgreSQL de autenticación comprueba el hash de refresh tokens, la metadata, la actualización de `last_seen_at`, la rotación concurrente, la revocación y la migration sobre sesiones existentes. También crea dos usuarios y dos empresas temporales para validar acceso a múltiples empresas, roles, membresías inactivas y rechazo de selección cruzada. Todos los datos, schemas y bases temporales de prueba se eliminan al finalizar:

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

La empresa, el schema y sus migrations se crean dentro de una sola transacción. Un fallo revierte todos los pasos y un slug repetido responde con HTTP `409`. Las migrations del tenant crean su tabla de control y las tablas `sucursales`, `vestidos`, `clientes`, `reservaciones` y `reservacion_vestidos`.

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

El UUID de `clientes` se utiliza como `clienteId` de reservaciones. Todavía no existen historial de rentas, documentos, imágenes ni deduplicación automática de clientes.

### CRUD de clientes

Todas las rutas requieren un access token con una empresa seleccionada. El backend aplica `JwtAuthGuard` → `TenantAuthGuard` → `RolesGuard`, obtiene el tenant del token verificado y vuelve a consultar la membresía y la empresa en cada solicitud. No se aceptan `empresaId`, `empresaSlug` ni `schemaName` en rutas, query strings o DTOs; los headers personalizados tampoco se utilizan para seleccionar el tenant.

```text
POST   /api/clientes
GET    /api/clientes
GET    /api/clientes/:id
PATCH  /api/clientes/:id
PATCH  /api/clientes/:id/estado
DELETE /api/clientes/:id
```

Los DTOs son estrictos y rechazan campos desconocidos:

- Creación: `nombre` y, como mínimo, uno entre `telefono` y `email`; también admite `direccion` y `notas`.
- Actualización: admite parcialmente `nombre`, `telefono`, `email`, `direccion` y `notas`, pero no `activo`. El estado final debe conservar teléfono o email.
- Cambio de estado: acepta exclusivamente `{ "activo": true }` o `{ "activo": false }`.
- Listado: admite `page`, `limit`, `activo` y `q`. `q` busca por nombre, email o teléfono.

La página predeterminada es `1`, el límite predeterminado es `20` y el máximo es `100`. El orden estable es `createdAt DESC, id DESC`, y la respuesta tiene este formato:

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

La matriz inicial de permisos es:

| Operación                    | `OWNER` | `EMPLOYEE` |
| ---------------------------- | ------- | ---------- |
| Crear                        | Sí      | Sí         |
| Listar y consultar           | Sí      | Sí         |
| Actualizar datos de contacto | Sí      | Sí         |
| Desactivar o reactivar       | Sí      | No (`403`) |

`DELETE` nunca elimina una fila: establece `activo=false`. Un UUID inexistente o perteneciente a otro tenant responde `404`. Una membresía o empresa inactiva pierde acceso inmediatamente.

Ejemplos, usando un access token emitido después de seleccionar la empresa:

```bash
curl --request POST http://localhost:3000/api/clientes \
  --header "Authorization: Bearer $ACCESS_TOKEN" \
  --header 'Content-Type: application/json' \
  --data '{"nombre":"Ana López","telefono":"555-0100","email":"ANA@EXAMPLE.COM"}'

curl 'http://localhost:3000/api/clientes?page=1&limit=20&activo=true&q=ana' \
  --header "Authorization: Bearer $ACCESS_TOKEN"

curl --request PATCH http://localhost:3000/api/clientes/CLIENTE_UUID \
  --header "Authorization: Bearer $ACCESS_TOKEN" \
  --header 'Content-Type: application/json' \
  --data '{"telefono":"555-0200","notas":"Prefiere contacto por la tarde"}'

curl --request PATCH http://localhost:3000/api/clientes/CLIENTE_UUID/estado \
  --header "Authorization: Bearer $ACCESS_TOKEN" \
  --header 'Content-Type: application/json' \
  --data '{"activo":false}'
```

## Modelo tenant de reservaciones

Las reservaciones existen únicamente dentro del schema de cada empresa y se almacenan en dos tablas:

- `reservaciones`: cabecera relacionada con un cliente y una sucursal.
- `reservacion_vestidos`: detalle con uno o varios vestidos físicos y la copia histórica de sus importes.

La cabecera contiene `cliente_id`, `sucursal_id`, `fecha_inicio`, `fecha_fin`, estado, notas, `importe_renta`, `deposito_requerido`, las fechas opcionales de confirmación, entrega, devolución y cancelación, el motivo opcional de cancelación y las fechas de creación y actualización. El detalle contiene `reservacion_id`, `vestido_id`, `precio_renta`, `deposito` y `created_at`.

Los importes utilizan `numeric(12,2)`, son no negativos y se representan como cadenas en TypeScript para evitar cálculos con punto flotante. `reservacion_vestidos.precio_renta` y `reservacion_vestidos.deposito` son copias de los valores vigentes al agregar la pieza. Cambiar posteriormente el precio o depósito del catálogo no modifica el histórico; un vestido sin depósito se representará en el detalle con `0.00`.

Los estados modelados inicialmente son:

```text
BORRADOR
CONFIRMADA
ENTREGADA
DEVUELTA
CANCELADA
```

El estado predeterminado es `BORRADOR`. Las transiciones se ejecutan únicamente mediante los endpoints explícitos de confirmar, entregar, devolver y cancelar descritos más adelante.

### Rangos de fechas

`fecha_inicio` y `fecha_fin` usan `timestamptz` y forman un rango semiabierto `[fechaInicio, fechaFin)`: el inicio pertenece a la reservación y el instante final no. Por ello, una reservación puede terminar exactamente cuando comienza otra. PostgreSQL exige `fecha_fin > fecha_inicio`; las APIs reciben fechas ISO 8601 con zona horaria explícita.

No existe una restricción de exclusión en la tabla. La creación, confirmación y actualización de reservaciones confirmadas serializan por vestido mediante locks transaccionales y vuelven a comprobar solapamientos antes del commit. La disponibilidad se consulta mediante `GET /api/vestidos/disponibilidad`.

Las llaves foráneas hacia cliente, sucursal y vestido apuntan a tablas del mismo schema tenant y usan `ON DELETE RESTRICT`. Una reservación no puede repetir el mismo vestido porque `reservacion_id + vestido_id` es único. Los índices cubren consultas por cliente, sucursal, estado, fechas, reservación y vestido.

La migration tenant `CreateReservaciones1795215600000` crea tablas, llaves, checks e índices iniciales. `OptimizeReservaciones1795302000000` añade índices que cubren el orden paginado `createdAt + id`, filtros por sucursal y fechas, búsqueda por cliente y el join de solapamientos `vestidoId + reservacionId`. Ambas se aplican automáticamente a empresas nuevas. Para aplicarlas de forma idempotente a schemas existentes:

```bash
npm run tenant:migration:run
```

No existen tablas de reservaciones en `public`.

### Creación segura de reservaciones

`POST /api/reservaciones` permite crear reservaciones a membresías activas `OWNER` y `EMPLOYEE`. La ruta utiliza `JwtAuthGuard`, `TenantAuthGuard` y `RolesGuard`; el tenant se obtiene exclusivamente del `TenantScope` autenticado.

El cuerpo acepta únicamente:

```json
{
  "clienteId": "a18c2a56-d33f-4d88-a8e7-42931121e295",
  "sucursalId": "b18c2a56-d33f-4d88-a8e7-42931121e295",
  "vestidoIds": ["c18c2a56-d33f-4d88-a8e7-42931121e295"],
  "fechaInicio": "2026-12-10T16:00:00-07:00",
  "fechaFin": "2026-12-12T16:00:00-07:00",
  "notas": "Entrega por la tarde",
  "confirmar": true
}
```

`confirmar` es opcional y vale `true` por defecto. `true` crea una reservación `CONFIRMADA`; `false` crea un `BORRADOR`. Se exige entre 1 y 50 vestidos sin UUID repetidos, fechas ISO 8601 con zona horaria explícita y `fechaFin > fechaInicio`. Los campos desconocidos, importes, totales, estados y selectores de tenant son rechazados.

Dentro de una única llamada a `TenantContextService.run()`, el backend:

1. Comprueba que cliente y sucursal estén activos en el tenant autenticado.
2. Realiza una comprobación rápida de conflictos y, si no encuentra ninguno, adquiere advisory locks transaccionales por vestido en orden de UUID.
3. Valida que todos los vestidos estén activos, disponibles operativamente y pertenezcan a la sucursal.
4. Consulta nuevamente los conflictos después de adquirir los locks.
5. Copia precios y depósitos, suma los importes con aritmética decimal basada en `bigint` y guarda cabecera y detalles.
6. Confirma la transacción únicamente si todos los pasos terminan correctamente.

Las claves de lock se derivan internamente de `empresaId` verificado y `vestidoId`; no se reciben del cliente. Los locks son `pg_advisory_xact_lock`, por lo que PostgreSQL los libera automáticamente en `COMMIT` o `ROLLBACK`. El orden estable evita deadlocks entre reservaciones con varios vestidos.

Solamente `CONFIRMADA` y `ENTREGADA` bloquean disponibilidad. La consulta utiliza el rango semiabierto:

```text
existente.fechaInicio < nueva.fechaFin
AND existente.fechaFin > nueva.fechaInicio
```

Por ello los rangos contiguos están permitidos. Los borradores pueden solaparse; un conflicto al confirmar responde `409` sin indicar cuál pieza causó el conflicto. Cualquier fallo revierte tanto la cabecera como los detalles y libera los locks.

Ejemplo:

```bash
curl --request POST http://localhost:3000/api/reservaciones \
  --header "Authorization: Bearer $ACCESS_TOKEN" \
  --header 'Content-Type: application/json' \
  --data '{
    "clienteId":"a18c2a56-d33f-4d88-a8e7-42931121e295",
    "sucursalId":"b18c2a56-d33f-4d88-a8e7-42931121e295",
    "vestidoIds":["c18c2a56-d33f-4d88-a8e7-42931121e295"],
    "fechaInicio":"2026-12-10T16:00:00-07:00",
    "fechaFin":"2026-12-12T16:00:00-07:00"
  }'
```

La respuesta incluye cliente y sucursal básicos, vestidos con sus importes históricos, totales, fechas y estado. No incluye nombres de schemas. Las transiciones se ejecutan mediante las operaciones específicas documentadas abajo; todavía no existen pagos ni imágenes.

### Consulta y actualización de reservaciones

`OWNER` y `EMPLOYEE` pueden utilizar:

```text
GET   /api/reservaciones
GET   /api/reservaciones/:id
PATCH /api/reservaciones/:id
```

El listado acepta `page`, `limit`, `clienteId`, `sucursalId`, `estado`, `fechaDesde`, `fechaHasta` y `q`. `q` busca sin distinguir mayúsculas por nombre, email o teléfono del cliente. Si se proporciona un rango, se devuelven las reservaciones que se solapan mediante `fechaInicio < fechaHasta AND fechaFin > fechaDesde`. También se admiten límites abiertos proporcionando solamente una de las dos fechas.

```bash
curl --get http://localhost:3000/api/reservaciones \
  --header "Authorization: Bearer $ACCESS_TOKEN" \
  --data-urlencode 'estado=CONFIRMADA' \
  --data-urlencode 'fechaDesde=2026-12-10T16:00:00-07:00' \
  --data-urlencode 'fechaHasta=2026-12-12T16:00:00-07:00' \
  --data-urlencode 'q=ana' \
  --data-urlencode 'page=1' \
  --data-urlencode 'limit=20'
```

El orden es `createdAt DESC, id DESC`. Cada elemento incluye cliente y sucursal básicos, fechas, estado, notas, totales y `vestidosCount`; el conteo se obtiene sin consultas N+1. El formato paginado es:

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

El detalle carga en una sola consulta el cliente, la sucursal y todos los vestidos. Para cada vestido devuelve el precio y depósito históricos, además de totales, notas y los timestamps `confirmadaAt`, `entregadaAt`, `devueltaAt` y `canceladaAt`.

`PATCH /api/reservaciones/:id` acepta exclusivamente `clienteId`, `sucursalId`, `vestidoIds`, `fechaInicio`, `fechaFin` y `notas`, y exige al menos un campo. No permite modificar estado, importes ni timestamps del ciclo de vida.

```bash
curl --request PATCH http://localhost:3000/api/reservaciones/RESERVACION_UUID \
  --header "Authorization: Bearer $ACCESS_TOKEN" \
  --header 'Content-Type: application/json' \
  --data '{
    "vestidoIds":["c18c2a56-d33f-4d88-a8e7-42931121e295"],
    "fechaInicio":"2026-12-11T16:00:00-07:00",
    "fechaFin":"2026-12-13T16:00:00-07:00",
    "notas":"Ajuste solicitado por la clienta"
  }'
```

Solamente `BORRADOR` y `CONFIRMADA` son editables. Para cambios estructurales se vuelven a validar referencias activas, sucursal y rango. Los vestidos existentes conservan sus snapshots; las piezas agregadas toman los importes actuales y los totales se recalculan con aritmética decimal exacta.

Las confirmadas bloquean la fila de reservación y la unión ordenada de vestidos anteriores y nuevos, excluyen su propio UUID al buscar solapamientos y responden `409` ante conflictos. Los borradores pueden solaparse. Todo se ejecuta en una única transacción tenant. `ENTREGADA`, `DEVUELTA` y `CANCELADA` responden `409`; sus transiciones de estado no forman parte de este `PATCH`.

### Ciclo de vida de la renta

Las transiciones se exponen como operaciones explícitas; no existe un endpoint genérico para enviar un estado arbitrario:

```text
POST /api/reservaciones/:id/confirmar
POST /api/reservaciones/:id/entregar
POST /api/reservaciones/:id/devolver
POST /api/reservaciones/:id/cancelar
```

El diagrama permitido es:

```text
BORRADOR ── confirmar ──> CONFIRMADA ── entregar ──> ENTREGADA ── devolver ──> DEVUELTA
BORRADOR ── cancelar ────────────────────────────────────────────> CANCELADA
CONFIRMADA ── cancelar ─────────────────────────────────────────> CANCELADA
```

`DEVUELTA` y `CANCELADA` son terminales. Cualquier salto, repetición o transición fuera del diagrama responde `409`.

| Operación | OWNER     | EMPLOYEE  |
| --------- | --------- | --------- |
| Confirmar | Permitido | Permitido |
| Entregar  | Permitido | Permitido |
| Devolver  | Permitido | Permitido |
| Cancelar  | Permitido | `403`     |

El rol se obtiene de la membresía vigente comprobada por `TenantAuthGuard` y `RolesGuard`; desactivar la membresía o empresa revoca inmediatamente estas operaciones.

Al confirmar un borrador, la transacción bloquea primero la reservación, adquiere advisory locks por vestido en orden estable y vuelve a comprobar cliente, sucursal, catálogo y solapamientos. Esto impide que dos borradores solapados confirmen simultáneamente la misma pieza. La confirmación establece `confirmadaAt`.

La entrega exige una reservación `CONFIRMADA`, vuelve a comprobar que las piezas estén activas y operativamente disponibles y establece `entregadaAt`. No cambia `estadoOperativo`: ese campo continúa representando mantenimiento, no ocupación por calendario. La devolución exige `ENTREGADA`, establece `devueltaAt` y libera la disponibilidad porque `DEVUELTA` no bloquea fechas.

La cancelación solo admite `BORRADOR` o `CONFIRMADA`, establece `canceladaAt` y libera inmediatamente la disponibilidad. Su cuerpo es opcional y acepta únicamente un motivo de hasta 1,000 caracteres:

```bash
curl --request POST http://localhost:3000/api/reservaciones/RESERVACION_UUID/cancelar \
  --header "Authorization: Bearer $ACCESS_TOKEN" \
  --header 'Content-Type: application/json' \
  --data '{"motivo":"Cambio de planes"}'
```

Ejemplo de avance normal:

```bash
curl --request POST http://localhost:3000/api/reservaciones/RESERVACION_UUID/confirmar \
  --header "Authorization: Bearer $ACCESS_TOKEN"

curl --request POST http://localhost:3000/api/reservaciones/RESERVACION_UUID/entregar \
  --header "Authorization: Bearer $ACCESS_TOKEN"

curl --request POST http://localhost:3000/api/reservaciones/RESERVACION_UUID/devolver \
  --header "Authorization: Bearer $ACCESS_TOKEN"
```

Todas las transiciones usan `TenantContextService`, `SET LOCAL search_path` y un lock de escritura sobre la fila antes de evaluar el estado. Los UUID de otro tenant responden `404` y ninguna respuesta incluye nombres de schemas. Todavía no se gestionan pagos, reembolsos, daños, mantenimiento automático, imágenes ni auditoría completa.

### Seguridad, integridad y concurrencia de reservaciones

Todas las rutas de reservaciones y disponibilidad aplican `JwtAuthGuard`, `TenantAuthGuard` y `RolesGuard` mediante `@TenantAuthenticated()`. `TenantAuthGuard` toma `empresaId` exclusivamente del JWT verificado, consulta nuevamente usuario, membresía y empresa, resuelve el `TenantScope` con `TenantResolverService.resolveByEmpresaId()` y conserva el rol vigente de la membresía. Usuario o sesión inactivos reciben `401`; membresía o empresa inactivas reciben `403` inmediatamente.

Los DTOs rechazan campos desconocidos y nunca aceptan `empresaId`, `empresaSlug`, `schemaName`, estados, importes, totales, timestamps o claves de lock controladas por el cliente. Los headers personalizados de empresa o schema no intervienen en la resolución. Todas las consultas tenant usan parámetros; la única interpolación SQL es el schema generado y validado internamente por el backend.

| Operación                        | OWNER     | EMPLOYEE  |
| -------------------------------- | --------- | --------- |
| Consultar disponibilidad         | Permitido | Permitido |
| Crear reservación                | Permitido | Permitido |
| Listar reservaciones             | Permitido | Permitido |
| Consultar reservación            | Permitido | Permitido |
| Actualizar borrador o confirmada | Permitido | Permitido |
| Confirmar                        | Permitido | Permitido |
| Entregar                         | Permitido | Permitido |
| Devolver                         | Permitido | Permitido |
| Cancelar                         | Permitido | `403`     |

La cabecera y sus detalles se escriben en una sola transacción. Las llaves foráneas impiden detalles huérfanos, la combinación reservación–vestido es única y los checks protegen rangos e importes. Los totales se calculan en el backend a partir de snapshots decimales; cambios posteriores del catálogo no alteran el histórico. Solamente `CONFIRMADA` y `ENTREGADA` bloquean el calendario.

Las pruebas PostgreSQL ejecutan carreras reales para creación confirmada, confirmación de borradores, actualización de fechas, entrega duplicada y cancelación simultánea con confirmación. También comprueban orden estable de locks para varias piezas, rollback completo, totales, ausencia de huérfanos, aislamiento entre dos empresas y limpieza de `search_path` usando `DB_POOL_MAX=1`.

### Consulta de disponibilidad de vestidos

`GET /api/vestidos/disponibilidad` permite a `OWNER` y `EMPLOYEE` consultar piezas libres para un rango. La ruta estática se registra antes de `GET /api/vestidos/:id` y utiliza los mismos guards JWT, tenant y roles del catálogo.

Son obligatorios `sucursalId`, `fechaInicio` y `fechaFin`. Opcionalmente acepta `talla`, `color`, `estadoOperativo`, `page` y `limit`. La página predeterminada es `1`, el límite predeterminado es `20` y el máximo es `100`. `estadoOperativo` utiliza `DISPONIBLE` por defecto.

```bash
curl --get http://localhost:3000/api/vestidos/disponibilidad \
  --header "Authorization: Bearer $ACCESS_TOKEN" \
  --data-urlencode 'sucursalId=b18c2a56-d33f-4d88-a8e7-42931121e295' \
  --data-urlencode 'fechaInicio=2026-12-10T16:00:00-07:00' \
  --data-urlencode 'fechaFin=2026-12-12T16:00:00-07:00' \
  --data-urlencode 'talla=M' \
  --data-urlencode 'color=Azul' \
  --data-urlencode 'page=1' \
  --data-urlencode 'limit=20'
```

La disponibilidad combina dos conceptos independientes:

- Disponibilidad operativa: el campo actual `estadoOperativo` del vestido. Una pieza en `MANTENIMIENTO` no es rentable, aunque no tenga reservaciones.
- Disponibilidad por calendario: ausencia de reservaciones `CONFIRMADA` o `ENTREGADA` que se solapen con el rango solicitado.

Si se solicita explícitamente `estadoOperativo=MANTENIMIENTO`, el endpoint devuelve las piezas activas de ese estado que estén libres por calendario y conserva `MANTENIMIENTO` en la respuesta. Esto permite inspeccionarlas sin presentarlas como rentables.

La consulta ignora reservaciones `BORRADOR`, `CANCELADA` y `DEVUELTA`, aplica la misma regla semiabierta de solapamiento y permite periodos contiguos. Internamente utiliza un `NOT EXISTS` parametrizado sobre `reservacion_vestidos` y `reservaciones`, junto con los índices por vestido, estado y fechas; la sucursal se carga mediante join y no se realizan consultas por cada pieza.

La respuesta incluye el catálogo actual, precio, depósito, estado operativo, sucursal básica, paginación y el rango normalizado a UTC:

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 0
  },
  "range": {
    "fechaInicio": "2026-12-10T23:00:00.000Z",
    "fechaFin": "2026-12-12T23:00:00.000Z"
  }
}
```

La consulta no crea ni modifica reservaciones y nunca acepta ni expone selectores o nombres de schemas.

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

`estado_operativo=DISPONIBLE` indica que la pieza puede operar normalmente; la disponibilidad para un rango se consulta mediante `GET /api/vestidos/disponibilidad` a partir de reservaciones bloqueantes.

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

El historial de movimientos, la auditoría completa y las imágenes quedan fuera de este alcance.

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

Sucursales, clientes, vestidos, disponibilidad y reservaciones utilizan el flujo reutilizable JWT → `TenantScope` → transacción:

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

Las suites crean usuarios, empresas, sucursales, clientes, vestidos y reservaciones temporales, permiten los mismos códigos y rangos en tenants distintos y fuerzan `DB_POOL_MAX=1` para comprobar que `search_path` vuelve a `public` al reutilizar la conexión. `test:auth-database` recorre las rutas HTTP con access tokens OWNER y EMPLOYEE y comprueba revocación inmediata por usuario, sesión, membresía o empresa; `test:tenancy` verifica directamente en PostgreSQL migrations, paginación, snapshots, integridad, disponibilidad, concurrencia e aislamiento.

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

Para aplicar y comprobar migrations tenant pendientes sobre todas las empresas registradas:

```bash
npm run tenant:migration:run
```

La suite elimina en `afterAll` únicamente las empresas y schemas temporales que ella misma creó.

## Desarrollo

### Arquitectura frontend

La aplicación Angular organiza `apps/web/src/app` por responsabilidad:

```text
core/       configuración y clientes de infraestructura
shared/     UI presentacional reutilizable
layouts/    contenedores de rutas
features/   funcionalidades por dominio
```

Las rutas base son `/`, `/login`, `/seleccionar-empresa`, `/cuenta` y `/app`. Login y selección de empresa son funcionales; `/cuenta` exige únicamente `authGuard`, mientras `/app` exige además un tenant seleccionado mediante `tenantGuard`.

La URL del API se inyecta mediante `API_BASE_URL`: desarrollo usa `http://localhost:3000/api` y producción usa `/api`. Los servicios futuros deben consumir el `ApiClient` genérico con rutas relativas; no deben duplicar URLs absolutas ni aceptar nombres de schemas. Los errores se normalizan como `ApiError` y los estados comunes de carga, error, vacío y envío están disponibles en `shared/ui`.

El estado de autenticación frontend vive en `core/auth` y utiliza un `AuthStore` basado en signals. Al arrancar, Angular intenta rotar la cookie HttpOnly y consulta `/auth/me`; si la sesión es válida mantiene únicamente el access token y su expiración en memoria. La inicialización está deduplicada y limitada a 10 segundos. El interceptor agrega Bearer solo a solicitudes dirigidas al API configurado, comparte un único refresh ante solicitudes `401` concurrentes y nunca persiste tokens en almacenamiento del navegador. Un token obtenido por refresh se considera global, sin tenant seleccionado.

El formulario `/login` usa Reactive Forms y mensajes accesibles. `guestGuard` y `authGuard` separan rutas invitadas y autenticadas, conservando únicamente `returnUrl` internas. Login y refresh nunca reciben el header Bearer. El logout revoca la sesión, limpia siempre el estado local y navega de regreso a `/login`, aun si la llamada remota falla.

La seguridad global de cuenta está disponible en `/cuenta/sesiones`, incluso cuando el usuario no tiene empresas activas. El layout de cuenta no depende de `TenantScope` y enlaza de regreso a `/app` solamente cuando ya existe una empresa seleccionada; en otro caso vuelve a `/seleccionar-empresa`. También se puede abrir desde el menú de usuario del shell o desde la pantalla de selección de empresa.

La pantalla muestra exclusivamente la metadata segura entregada por `GET /auth/sessions`: dispositivo o user-agent, IP, última actividad, creación, expiración, estado e indicador de sesión actual. Cada revocación requiere confirmación. `DELETE /auth/sessions/:id` actualiza el listado si se trata de una sesión remota; si se revoca la sesión actual, limpia `AuthStore`, `TenantStore` y todos los stores registrados en `TenantResetRegistry` antes de navegar a `/login`. `POST /auth/sessions/revocar-otras` conserva la sesión actual y vuelve a cargar el estado autoritativo. La interfaz no persiste esta metadata ni muestra tokens, cookies, hashes o nombres de schemas.

La selección tenant vive en `core/tenant` y utiliza un `TenantStore` basado en signals. Después de restaurar la sesión global, Angular consulta `GET /auth/empresas` y selecciona mediante `POST /auth/select-empresa` enviando exclusivamente `empresaId`. Una sola empresa se selecciona automáticamente; con varias, `/seleccionar-empresa` muestra únicamente las opciones devueltas por el backend. La respuesta reemplaza en memoria el access token global por el token tenant y conserva el rol validado de la membresía.

Como preferencia se puede guardar únicamente `empresaId` en `localStorage`; nunca se persisten tokens, roles, datos de empresa ni nombres de schemas. En cada recarga la preferencia se contrasta con la lista actual del backend y vuelve a seleccionarse, por lo que una membresía revocada no restaura acceso. `TenantResetRegistry` permite que los próximos stores de negocio registren su limpieza; se ejecuta antes de cambiar de empresa y al cerrar sesión para impedir reutilizar datos del tenant anterior.

El flujo de arranque es:

```text
cookie HttpOnly → refresh global → /auth/me → /auth/empresas
  → selección automática o manual → access token tenant → /app
```

El shell autenticado de `/app` incorpora sidebar de escritorio, navegación móvil accesible, encabezado con empresa y rol vigentes, menú de usuario, cambio de empresa, logout y `router-outlet`. La raíz `/app` redirige a `/app/dashboard`; dashboard, sucursales, clientes, vestidos, disponibilidad y reservaciones se cargan como componentes standalone diferidos. Sucursales, clientes, vestidos, disponibilidad y reservaciones ya consumen datos reales; el dashboard continúa como placeholder.

`APP_NAVIGATION` es la fuente única de enlaces para escritorio y móvil. Sus políticas se filtran con `navigationForRole()` y `hasAnyRole()`; actualmente `OWNER` y `EMPLOYEE` pueden consultar todas las secciones. Esta visibilidad solo mejora la interfaz: los guards y permisos del API siguen siendo la autoridad. El shell muestra alertas claras si desaparece la sesión o el tenant seleccionado.

Los stores de futuros features que contengan información tenant deben registrar su limpieza en `TenantResetRegistry`. El registro se ejecuta al cambiar empresa y al cerrar sesión, antes de reutilizar el shell con otro tenant.

La consulta Angular de sucursales está disponible para `OWNER` y `EMPLOYEE` en `/app/sucursales`, con detalle en `/app/sucursales/:id`. Presenta nombre, dirección, teléfono y estado, y contempla carga, vacío, error, `403`, `404` y fallos de red.

`OWNER` también puede crear en `/app/sucursales/nueva`, editar en `/app/sucursales/:id/editar`, desactivar mediante baja lógica y reactivar. Los formularios usan Reactive Forms, normalizan espacios, respetan las longitudes del API, evitan doble envío y presentan conflictos `409`. Las acciones no se muestran a `EMPLOYEE`; cualquier `403` del backend deja intacto el estado local. El store incorpora mutaciones exitosas solo mientras continúa vigente la misma generación tenant y cancela todas las operaciones pendientes mediante `TenantResetRegistry` al cambiar de empresa.

La consulta Angular de clientes está disponible para `OWNER` y `EMPLOYEE` en `/app/clientes`, con detalle en `/app/clientes/:id`. El listado conserva `page`, `limit`, `activo` y `q` en query parameters, normaliza la búsqueda y aplica un debounce de 350 ms. Presenta el formato paginado estándar y muestra nombre, teléfono, email, dirección, notas y estado.

Las búsquedas nuevas cancelan su suscripción anterior y el store ignora cualquier respuesta obsoleta. `TenantResetRegistry` vacía listado y detalle y cancela solicitudes pendientes al cambiar de empresa. Un UUID ajeno al tenant se presenta como `404` sin revelar información interna. El frontend no construye ni envía `empresaId`, `empresaSlug` o `schemaName`.

`OWNER` y `EMPLOYEE` pueden crear clientes en `/app/clientes/nuevo` y editar datos en `/app/clientes/:id/editar`. El formulario compartido exige nombre y teléfono o email, normaliza texto, convierte el email a minúsculas y envía opcionales vacíos como `null`; nunca incluye `activo` en el `PATCH` general. Los filtros válidos del listado se conservan al navegar y regresar.

Solamente `OWNER` puede desactivar mediante `DELETE /api/clientes/:id` o reactivar mediante `PATCH /api/clientes/:id/estado`. La desactivación requiere confirmación y es una baja lógica. `EMPLOYEE` no ve acciones de estado y un `403` forzado no modifica el store. Las operaciones pendientes se cancelan al cambiar de tenant. Las pantallas no incluyen reservaciones ni historial de rentas.

El catálogo Angular de vestidos está disponible para `OWNER` y `EMPLOYEE` en `/app/vestidos`, con detalle en `/app/vestidos/:id`. El listado conserva `page`, `limit`, `sucursalId`, `activo`, `estadoOperativo` y `q` en query parameters; busca por código, nombre o marca y reutiliza el catálogo tenant de sucursales para el selector.

Cada pieza muestra código, nombre, sucursal, talla, color, marca, precio, depósito, estado operativo y estado activo. La interfaz diferencia visualmente piezas inactivas, disponibles operativamente y en mantenimiento, y aclara que `DISPONIBLE` no garantiza libertad para fechas. Los importes permanecen como strings decimales y se formatean para presentación sin conversiones ni cálculos de punto flotante.

`OWNER` puede crear en `/app/vestidos/nuevo`, editar o trasladar en `/app/vestidos/:id/editar`, y realizar baja lógica o reactivación desde el detalle. El formulario usa únicamente sucursales activas, normaliza el código, mantiene importes como strings decimales y exige confirmación antes de un traslado. `EMPLOYEE` no ve controles de escritura y el API conserva la autoridad ante peticiones forzadas.

`DressesStore` ignora respuestas obsoletas y limpia listado, detalle y mutaciones pendientes mediante `TenantResetRegistry`. Los filtros válidos se conservan al abrir un detalle o formulario; un UUID ajeno al tenant produce una vista `404` segura. No se incluyen imágenes de vestidos.

La consulta Angular de disponibilidad se encuentra en `/app/disponibilidad`. `OWNER` y `EMPLOYEE` pueden seleccionar una sucursal activa, un rango local y filtros por talla, color o estado operativo. La zona IANA y su offset se muestran de forma explícita; las fechas se envían como ISO 8601 UTC y se conservan, junto con la paginación, en query parameters permitidos.

Los resultados distinguen piezas libres por calendario de su aptitud operativa. Una pieza en `MANTENIMIENTO` puede aparecer al solicitar ese filtro, pero se identifica como no rentable. `AvailabilityStore` cancela consultas y limpia resultados al cambiar de tenant. La pantalla no crea reservaciones ni modifica vestidos.

El listado Angular de reservaciones se encuentra en `/app/reservaciones` y conserva filtros por cliente, sucursal, estado, rango, búsqueda y paginación en la URL. El detalle `/app/reservaciones/:id` muestra vestidos, snapshots históricos de precio y depósito, totales, notas, timestamps del ciclo y motivo de cancelación. La interfaz explica el rango semiabierto y nunca sustituye snapshots con precios actuales del catálogo.

La creación Angular se encuentra en `/app/reservaciones/nueva` y está disponible para `OWNER` y `EMPLOYEE`. El flujo selecciona cliente activo, sucursal, rango y entre 1 y 50 vestidos obtenidos desde la consulta de disponibilidad. Muestra importes actuales solamente como estimación y envía al backend únicamente referencias, fechas, notas y la elección entre confirmada —predeterminada— o borrador. Un conflicto `409` conserva el formulario y actualiza las piezas disponibles antes de solicitar una nueva revisión; no se envían totales, estados arbitrarios ni selectores tenant.

La edición Angular se encuentra en `/app/reservaciones/:id/editar` y solamente admite estados `BORRADOR` o `CONFIRMADA`. Conserva los snapshots existentes y diferencia claramente las piezas nuevas con precios actuales. El detalle expone confirmar, entregar, devolver y cancelar como acciones explícitas según el estado; `OWNER` y `EMPLOYEE` pueden confirmar, entregar y devolver, mientras que cancelar está reservado a `OWNER`. Cada transición requiere confirmación y vuelve a cargar el detalle autoritativo; un `409` concurrente muestra el estado actualizado.

`ReservationsStore` mantiene separados listado y detalle, cancela respuestas pendientes al cambiar de tenant y presenta un `404` seguro para UUIDs ajenos. Estas pantallas no incluyen pagos, daños ni reembolsos.

La auditoría frontend incorpora ESLint para TypeScript, Angular y accesibilidad de templates, además de Playwright para recorridos completos con API simulado. Las pruebas confirman tokens únicamente en memoria, refresh compartido sin ciclos, revocación inmediata, limpieza al cambiar tenant, separación entre `403` y `404`, ausencia de selectores tenant, límites de paginación, strings decimales y fechas con zona horaria. Los fixtures e2e utilizan únicamente identidades `.test`, tokens ficticios y datos en memoria.

Las convenciones completas para agregar features se encuentran en [`apps/web/README.md`](apps/web/README.md).

Para iniciar el API y la aplicación web al mismo tiempo:

```bash
npm run dev
```

También se pueden ejecutar por separado:

```bash
npm run dev:api
npm run dev:web
npm run lint
npm run test
npm run test:e2e:web
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

El API habilita credenciales CORS únicamente para los orígenes explícitos de `CORS_ALLOWED_ORIGINS`; en desarrollo, los valores predeterminados seguros son `http://localhost:4200` y `http://127.0.0.1:4200`. No se permite `*` y producción exige configurar la variable. Las rutas de autenticación permiten clientes sin header `Origin`, como `curl`, pero rechazan con `403` cualquier `Origin` de navegador que no esté autorizado.

## Validaciones

```bash
npm run build
npm test
npm run lint
npm run test:e2e --workspace=api
npm run test:auth-database
npm run test:tenancy
npm run tenant:migration:run
```

Los scripts se ejecutan desde la raíz y delegan a cada workspace cuando corresponde.
