# Aplicación web

Frontend standalone de Angular para Dresses SaaS. Tailwind CSS se carga globalmente desde `src/styles.css` y no se utiliza una biblioteca de componentes.

## Estructura

```text
src/app
├── core       # configuración y servicios singleton de infraestructura
├── shared     # componentes presentacionales reutilizables
├── layouts    # contenedores de rutas públicas y privadas
└── features   # funcionalidades agrupadas por dominio
```

Las rutas se cargan de forma diferida y actualmente preparan estos puntos de entrada:

| Ruta                         | Propósito                            |
| ---------------------------- | ------------------------------------ |
| `/`                          | Página pública                       |
| `/login`                     | Formulario de acceso para invitados  |
| `/seleccionar-empresa`       | Selección entre membresías vigentes  |
| `/app`                       | Redirección al dashboard autenticado |
| `/app/dashboard`             | Resumen de operación                 |
| `/app/sucursales`            | Punto de entrada para sucursales     |
| `/app/sucursales/nueva`      | Creación de sucursal para OWNER      |
| `/app/sucursales/:id`        | Detalle de una sucursal              |
| `/app/sucursales/:id/editar` | Edición de sucursal para OWNER       |
| `/app/clientes`              | Consulta paginada de clientes        |
| `/app/clientes/:id`          | Detalle de un cliente                |
| `/app/vestidos`              | Punto de entrada para catálogo       |
| `/app/disponibilidad`        | Punto de entrada para disponibilidad |
| `/app/reservaciones`         | Punto de entrada para reservaciones  |

La infraestructura restaura la sesión desde la cookie HttpOnly y mantiene el access token únicamente en memoria. Login, logout, selección de empresa y los guards están activos.

## Configuración del API

`API_BASE_URL` es el único token de configuración que deben consumir los servicios. Angular sustituye el archivo de entorno durante `ng serve`:

- desarrollo: `http://localhost:3000/api`;
- producción: `/api`, para usar el mismo origen del despliegue.

Los componentes no deben escribir URLs absolutas. `ApiClient` construye rutas relativas y ofrece métodos genéricos `GET`, `POST`, `PATCH` y `DELETE`; tampoco contiene autenticación ni permite seleccionar schemas.

Ejemplo para un futuro servicio de feature:

```ts
return this.apiClient.get<Cliente>('clientes/cliente-id');
```

Los errores HTTP se convierten al contrato `ApiError`, formado por `status`, `message`, `code` opcional y errores de validación opcionales. Los estados comunes de carga, error, vacío y envío se encuentran en `shared/ui`.

## Estado de autenticación

`core/auth` concentra la autenticación sin introducir una librería global de estado:

- `AuthApiService` consume login, refresh, logout y perfil;
- `AccessTokenStore` conserva el access token en una signal en memoria;
- `AuthStore` expone `status`, `user`, `accessTokenExpiresAt`, `initializationError`, `isInitializing` e `isAuthenticated` como signals de solo lectura;
- `authInterceptor` agrega Bearer únicamente a solicitudes del API configurado;
- el inicializador de la aplicación intenta restaurar la sesión mediante la cookie HttpOnly antes de completar el arranque.

Login, refresh, logout y perfil utilizan `withCredentials=true`. El refresh token nunca está disponible para Angular. No se utilizan `localStorage`, `sessionStorage`, IndexedDB ni cookies accesibles desde JavaScript para persistir tokens.

El ciclo inicial comienza en `initializing`, ejecuta un único refresh compartido y después consulta `/auth/me`. Una sesión válida pasa a `authenticated`; una respuesta `401` pasa a `anonymous` sin mostrarse como error de inicialización. Los errores de red se normalizan en `initializationError`, y un timeout de 10 segundos evita bloquear indefinidamente el renderizado. Los tokens obtenidos por refresh se consideran globales, sin tenant ni rol seleccionados.

Ante un `401` de una solicitud protegida, el interceptor comparte una sola rotación entre consumidores concurrentes y reintenta una vez con el access token nuevo. Login, refresh y perfil están excluidos del reintento para evitar ciclos. `Authorization` nunca se agrega a login, refresh ni URLs externas. Un refresh rechazado limpia inmediatamente la identidad y el access token locales.

## Login, guards y logout

`/login` utiliza Reactive Forms, valida correo y contraseña, muestra errores accesibles y evita envíos duplicados. Las credenciales incorrectas siempre producen el mismo mensaje genérico. Tras autenticar, una `returnUrl` interna tiene prioridad; de lo contrario se navega al futuro paso `/seleccionar-empresa`.

`authGuard` protege `/seleccionar-empresa` y `/app`, enviando al usuario anónimo a `/login` con su URL interna de retorno. `guestGuard` evita mostrar login a una sesión ya autenticada. El sanitizador rechaza protocolos, URLs externas, rutas relativas a otro host, barras invertidas y variantes codificadas.

El logout está disponible desde las superficies autenticadas. Siempre llama al API, limpia el estado aunque la solicitud falle y termina en `/login`.

## Estado tenant y selección de empresa

`core/tenant` mantiene la selección sin aceptar información interna de PostgreSQL:

- `TenantApiService` consulta `GET /auth/empresas` y selecciona con `POST /auth/select-empresa`;
- `TenantStore` expone como signals la lista disponible, empresa seleccionada, `empresaId`, rol y estado de carga;
- `tenantGuard` exige una selección verificada para entrar a `/app`;
- `TenantPreferenceService` guarda opcionalmente solo `empresaId`;
- `TenantResetRegistry` permite limpiar stores y cachés de features antes de cambiar de tenant.

Al arrancar, primero se restaura la autenticación global. Si continúa autenticada, la aplicación obtiene del backend las membresías vigentes. Una única empresa se selecciona automáticamente; con varias, la persona elige en `/seleccionar-empresa`. El access token devuelto por la selección sustituye al token global en memoria y contiene el contexto tenant validado por el backend.

En una recarga, el `empresaId` recordado nunca se considera autoridad: debe aparecer nuevamente en `GET /auth/empresas` y `POST /auth/select-empresa` debe aceptarlo. Si la membresía fue revocada, la opción se descarta y se muestra la selección actualizada. Un usuario sin empresas ve un estado informativo.

```text
sesión global → empresas vigentes → empresa seleccionada → sesión tenant → /app
```

No existen modelos, propiedades, headers, query strings ni cuerpos para `schemaName`. El listado de la pantalla proviene exclusivamente del backend. Para cambiar de empresa se solicita un token nuevo y se ejecutan primero los callbacks registrados en `TenantResetRegistry`, evitando reutilizar datos del tenant anterior.

## Shell autenticado y navegación

`layouts/app-layout` contiene el shell de `/app`:

- sidebar persistente desde el breakpoint de escritorio;
- menú móvil con foco inicial, ciclo de foco, cierre con `Escape` y atributos accesibles;
- encabezado con empresa, rol vigente y menú de usuario;
- cambio de empresa y logout;
- aviso de sesión o empresa expirada;
- enlace para saltar directamente al contenido;
- `router-outlet` para los módulos lazy-loaded.

`core/navigation/app-navigation.ts` es la única configuración de enlaces. `AppNavigationComponent` la representa tanto en el sidebar como en el panel móvil, evitando mantener dos menús manuales. Todas las rutas actuales son de consulta y están habilitadas para `OWNER` y `EMPLOYEE`.

`hasAnyRole()` y `navigationForRole()` permiten definir visibilidad por rol para acciones futuras. Ocultar una ruta, enlace o botón nunca reemplaza la autorización del backend; el API continúa verificando la membresía vigente y sus permisos.

Los componentes de dashboard, vestidos, disponibilidad y reservaciones son standalone y se importan de forma diferida como placeholders. Sucursales y clientes ya consumen datos reales del API.

## Consulta de sucursales

El feature `features/branches` se carga mediante `loadChildren`. Sus rutas hijas importan de forma diferida el listado y el detalle:

```text
GET /api/sucursales       → /app/sucursales
GET /api/sucursales/:id   → /app/sucursales/:id
```

`BranchesApiService` utiliza exclusivamente rutas relativas del tenant autenticado. No recibe ni construye `empresaId`, `empresaSlug` o `schemaName`. `BranchesStore` expone signals independientes para listado y detalle con estados `idle`, `loading`, `loaded`, `empty` y `error`.

El interceptor global sigue resolviendo respuestas `401`. El feature presenta `403` como pérdida de acceso o falta de autorización, `404` como sucursal inexistente o ajena al tenant, `409` como conflicto de nombre y los fallos de red con una acción de reintento. La respuesta visible incluye nombre, dirección, teléfono y estado activo/inactivo.

`BranchesStore` registra su limpieza en `TenantResetRegistry`. Un cambio de empresa vacía listado y detalle, y cancela las solicitudes pendientes para impedir que una respuesta tardía restaure información del tenant anterior.

### Mutaciones de sucursales

Las rutas de formulario también son lazy-loaded:

```text
/app/sucursales/nueva
/app/sucursales/:id/editar
```

| Operación  | OWNER | EMPLOYEE |
| ---------- | ----- | -------- |
| Consultar  | Sí    | Sí       |
| Crear      | Sí    | No       |
| Editar     | Sí    | No       |
| Desactivar | Sí    | No       |
| Reactivar  | Sí    | No       |

La interfaz oculta las acciones de escritura a `EMPLOYEE`, pero el API continúa siendo la autoridad. Si una membresía cambia mientras el formulario está abierto, un `403` se muestra como error de autorización y la lista y el detalle locales permanecen sin cambios.

El formulario reutilizable usa Reactive Forms y replica el contrato del API: nombre obligatorio de 2 a 160 caracteres, dirección opcional hasta 255 y teléfono opcional hasta 40. Antes de enviar recorta espacios y convierte opcionales vacíos a `null`. El estado `activo` nunca forma parte del formulario de datos.

Crear utiliza `POST /api/sucursales`, editar utiliza `PATCH /api/sucursales/:id`, reactivar envía exclusivamente `{ "activo": true }` mediante `PATCH` y desactivar utiliza `DELETE`. La desactivación requiere un diálogo de confirmación que aclara que se trata de una baja lógica recuperable. Todas las acciones bloquean envíos duplicados.

El store incorpora la respuesta exitosa al listado y detalle únicamente si la generación tenant sigue vigente. Una respuesta `403`, `409` o una mutación cancelada por cambio de empresa no altera el estado local.

## Consulta de clientes

El feature `features/customers` se carga con rutas hijas diferidas y está disponible para `OWNER` y `EMPLOYEE`:

```text
GET /api/clientes       → /app/clientes
GET /api/clientes/:id   → /app/clientes/:id
```

El listado utiliza el formato paginado estándar del API y conserva sus filtros en la URL:

```text
/app/clientes?page=2&limit=20&activo=true&q=ana
```

`page` comienza en `1`, `limit` en `20` y no supera `100`; `activo` admite `true` o `false`, y `q` busca por nombre, email o teléfono. La búsqueda recorta extremos, colapsa espacios consecutivos y espera 350 ms antes de actualizar la URL. Cada cambio vuelve a la primera página.

`CustomersStore` representa los estados `idle`, `loading`, `loaded`, `empty` y `error`. Las suscripciones del componente usan `switchMap` y el store identifica cada solicitud, de modo que una respuesta anterior nunca sobrescribe una búsqueda nueva. El registro en `TenantResetRegistry` cancela solicitudes pendientes y vacía listado y detalle al cambiar de empresa.

Las respuestas muestran nombre, teléfono, email, dirección, notas y estado. Un `404` de detalle se presenta sin revelar si el UUID pertenece a otro tenant; un `403` se trata como acceso perdido y los fallos de red permiten reintentar. El feature no envía selectores tenant ni expone nombres de schemas. En esta etapa no incluye creación, edición ni historial de rentas.

## Convenciones para features

- Crear componentes standalone dentro de `features/<dominio>`.
- Mantener acceso HTTP y estado de dominio en servicios del feature; los componentes coordinan la vista.
- Usar signals para estado local y derivado.
- Reutilizar `ApiClient`, `ApiError` y los componentes de `shared/ui`.
- No enviar `schemaName` ni construir rutas con nombres de schemas; el tenant se resuelve mediante la autenticación.
- No leer ni persistir manualmente tokens; consumir `AuthStore` y dejar el header Bearer al interceptor.
- Registrar en `TenantResetRegistry` la limpieza de cualquier store o caché que contenga datos tenant.
- Agregar la ruta con carga diferida y sus pruebas.

## Ejecución y validación

Desde la raíz del monorepo:

```bash
npm run dev:web
npm run build --workspace=web
npm run test --workspace=web
```

La aplicación se sirve en <http://localhost:4200>. Este workspace aún no tiene un target de lint; el build aplica la validación estricta de TypeScript y templates, y Prettier puede comprobarse con:

```bash
npx prettier --check "apps/web/**/*.{ts,html,css,json,md}"
```
