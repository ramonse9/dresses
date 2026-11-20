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

| Ruta                            | Propósito                             |
| ------------------------------- | ------------------------------------- |
| `/`                             | Página pública                        |
| `/login`                        | Formulario de acceso para invitados   |
| `/seleccionar-empresa`          | Selección entre membresías vigentes   |
| `/app`                          | Redirección al dashboard autenticado  |
| `/app/dashboard`                | Resumen de operación                  |
| `/app/sucursales`               | Punto de entrada para sucursales      |
| `/app/sucursales/nueva`         | Creación de sucursal para OWNER       |
| `/app/sucursales/:id`           | Detalle de una sucursal               |
| `/app/sucursales/:id/editar`    | Edición de sucursal para OWNER        |
| `/app/clientes`                 | Consulta paginada de clientes         |
| `/app/clientes/nuevo`           | Creación de cliente                   |
| `/app/clientes/:id`             | Detalle de un cliente                 |
| `/app/clientes/:id/editar`      | Edición de datos del cliente          |
| `/app/vestidos`                 | Catálogo paginado de vestidos         |
| `/app/vestidos/nuevo`           | Creación de vestido para OWNER        |
| `/app/vestidos/:id`             | Detalle de una pieza física           |
| `/app/vestidos/:id/editar`      | Edición y traslado para OWNER         |
| `/app/disponibilidad`           | Consulta de disponibilidad por fechas |
| `/app/reservaciones`            | Listado paginado de reservaciones     |
| `/app/reservaciones/nueva`      | Creación guiada de reservaciones      |
| `/app/reservaciones/:id`        | Detalle e importes históricos         |
| `/app/reservaciones/:id/editar` | Edición de borrador o confirmada      |

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

El dashboard continúa como placeholder standalone. Sucursales, clientes, vestidos, disponibilidad y reservaciones ya consumen datos reales del API mediante rutas diferidas.

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

Las respuestas muestran nombre, teléfono, email, dirección, notas y estado. Un `404` de detalle se presenta sin revelar si el UUID pertenece a otro tenant; un `403` se trata como acceso perdido y los fallos de red permiten reintentar. El feature no envía selectores tenant ni expone nombres de schemas.

### Mutaciones de clientes

`OWNER` y `EMPLOYEE` pueden crear en `/app/clientes/nuevo` y editar en `/app/clientes/:id/editar`. Un formulario Reactive Forms reutilizable exige nombre y al menos uno entre teléfono o email. Antes de enviar recorta espacios, convierte el email a minúsculas y transforma campos opcionales vacíos en `null`; el `PATCH` general nunca incluye `activo`.

| Operación  | OWNER | EMPLOYEE |
| ---------- | ----- | -------- |
| Crear      | Sí    | Sí       |
| Editar     | Sí    | Sí       |
| Desactivar | Sí    | No       |
| Reactivar  | Sí    | No       |

Crear utiliza `POST /api/clientes`, editar `PATCH /api/clientes/:id`, reactivar `PATCH /api/clientes/:id/estado` con `{ "activo": true }` y desactivar `DELETE /api/clientes/:id`. La baja lógica requiere confirmación y no elimina físicamente el registro. Las acciones de estado no se muestran a `EMPLOYEE`; el API continúa siendo la autoridad ante peticiones forzadas.

Los enlaces conservan solamente `page`, `limit`, `activo` y `q`, por lo que regresar desde alta, edición o detalle restaura la vista previa sin propagar parámetros desconocidos. Las mutaciones pendientes se cancelan al cambiar de tenant y una respuesta `400`, `403`, `404` o de red no altera los datos locales. No se implementan reservaciones ni historial de rentas en este feature.

## Catálogo de vestidos

`features/dresses` se carga mediante rutas hijas lazy y permite consultar a `OWNER` y `EMPLOYEE`:

```text
GET /api/vestidos       → /app/vestidos
GET /api/vestidos/:id   → /app/vestidos/:id
```

El listado conserva en query parameters `page`, `limit`, `sucursalId`, `activo`, `estadoOperativo` y `q`. La búsqueda por código, nombre o marca se normaliza y aplica un debounce de 350 ms. El selector de sucursal reutiliza el store tenant de sucursales y los valores inválidos de la URL se descartan antes de consultar el API.

Cada tarjeta y detalle muestran código, nombre, sucursal, talla, color, marca, precio de renta, depósito, estado operativo y estado activo. `DISPONIBLE`, `MANTENIMIENTO` e `INACTIVO` usan tratamientos visuales distintos. La interfaz aclara que `DISPONIBLE` significa aptitud operativa y no disponibilidad garantizada para fechas.

`precioRenta` y `deposito` permanecen como strings decimales. `formatDressMoney()` agrega símbolo, separadores y dos decimales manipulando caracteres; no convierte los valores a `number` ni realiza cálculos de punto flotante. Un depósito `null` se presenta como “No requerido”.

`DressesStore` ignora respuestas obsoletas y registra su limpieza en `TenantResetRegistry`, por lo que listado, detalle y solicitudes pendientes se descartan al cambiar de empresa. Los enlaces de detalle conservan únicamente los filtros permitidos. Un UUID de otro tenant se presenta como `404` sin información interna.

### Mutaciones de vestidos

| Operación  | OWNER | EMPLOYEE |
| ---------- | ----- | -------- |
| Crear      | Sí    | No       |
| Editar     | Sí    | No       |
| Trasladar  | Sí    | No       |
| Desactivar | Sí    | No       |
| Reactivar  | Sí    | No       |

El alta utiliza `POST /api/vestidos`, la edición y reactivación `PATCH /api/vestidos/:id`, y la baja lógica `DELETE /api/vestidos/:id`. Las acciones se ocultan a `EMPLOYEE`, pero el API sigue siendo la autoridad y un `403` forzado no modifica el estado local.

El formulario carga únicamente sucursales activas. Normaliza el código a mayúsculas, recorta texto, convierte opcionales vacíos en `null` y conserva `precioRenta` y `deposito` como strings decimales no negativos con máximo dos posiciones; nunca utiliza `Number` para transformarlos. Cambiar `sucursalId` requiere una confirmación explícita de traslado antes de enviar el `PATCH`.

La baja es lógica y recuperable. Los conflictos de código (`409`), recursos o sucursales inexistentes (`404`), pérdida de rol (`403`) y validaciones (`400`) se muestran sin mezclar información de otro tenant. Las mutaciones se cancelan al cambiar de empresa y las respuestas del API nunca se completan con nombres internos de schemas. Este feature no incluye imágenes.

## Disponibilidad por fechas

`/app/disponibilidad` está disponible para `OWNER` y `EMPLOYEE` y consume exclusivamente:

```text
GET /api/vestidos/disponibilidad
```

La consulta exige una sucursal activa, fecha inicial y fecha final. Admite filtros por `talla`, `color` y `estadoOperativo`, además de `page` y `limit` con máximo de 100. Los filtros válidos se conservan en query parameters; la pantalla no construye ni acepta `empresaId`, `empresaSlug` o `schemaName`.

Los campos `datetime-local` se interpretan en la zona horaria informada por el navegador. La interfaz muestra el identificador IANA y su desplazamiento UTC; antes de consultar convierte ambos extremos a ISO 8601 en UTC con sufijo `Z`. Se rechazan fechas locales inexistentes y rangos donde `fechaFin <= fechaInicio`.

La pantalla distingue dos conceptos:

- disponibilidad operativa: `DISPONIBLE` puede rentarse y `MANTENIMIENTO` no;
- disponibilidad por calendario: ausencia de reservaciones bloqueantes solapadas con el rango.

Una búsqueda explícita de `MANTENIMIENTO` puede mostrar piezas libres por calendario, siempre con la etiqueta “No rentable · mantenimiento”. Los importes se conservan como strings decimales y se presentan con el mismo formateador seguro del catálogo. La pantalla solamente consulta: no crea reservaciones ni cambia estados.

`AvailabilityStore` registra su limpieza en `TenantResetRegistry`, cancela respuestas pendientes al cambiar de empresa y mantiene estados `idle`, `loading`, `loaded`, `empty` y `error`. Un `404` de sucursal se presenta sin revelar si el UUID existe en otro tenant.

## Consulta de reservaciones

`features/reservations` se carga mediante rutas hijas lazy y permite consultar a `OWNER` y `EMPLOYEE`:

```text
GET /api/reservaciones       → /app/reservaciones
GET /api/reservaciones/:id   → /app/reservaciones/:id
```

El listado conserva `clienteId`, `sucursalId`, `estado`, `fechaDesde`, `fechaHasta`, `q`, `page` y `limit` en query parameters. `q` busca por nombre, email o teléfono del cliente; las fechas locales se convierten a ISO 8601 con zona explícita antes de enviarse. Si se indican ambos límites, la interfaz exige que `fechaHasta` sea posterior a `fechaDesde`.

Cada tarjeta muestra cliente, sucursal, rango, estado, renta total, depósito requerido y `vestidosCount`. El rango se explica como semiabierto `[fechaInicio, fechaFin)`: la hora final no forma parte del periodo ocupado. Los cinco estados visibles son `BORRADOR`, `CONFIRMADA`, `ENTREGADA`, `DEVUELTA` y `CANCELADA`.

El detalle presenta contacto del cliente, sucursal, notas, motivo de cancelación, timestamps del ciclo y cada vestido relacionado. `precioRenta` y `deposito` de cada pieza se etiquetan como snapshots históricos capturados por la reservación; la pantalla no consulta ni presenta precios actuales del catálogo como sustitutos. Todos los importes permanecen como strings decimales.

`ReservationsStore` separa estado de listado y detalle, ignora respuestas obsoletas y cancela solicitudes pendientes mediante `TenantResetRegistry`. Los filtros válidos se conservan al abrir y cerrar un detalle. Un UUID inexistente o de otro tenant muestra un `404` seguro sin información del schema.

### Creación de reservaciones

`/app/reservaciones/nueva` ofrece a `OWNER` y `EMPLOYEE` un flujo por secciones: cliente activo, sucursal activa, rango, vestidos disponibles y confirmación final. La búsqueda de clientes utiliza `GET /api/clientes` con `activo=true`; al seleccionar sucursal y rango se consulta `GET /api/vestidos/disponibilidad`. Cambiar cualquiera de esos datos limpia las piezas seleccionadas y vuelve a comprobar el calendario.

Se pueden seleccionar entre 1 y 50 piezas sin duplicados. La interfaz muestra precio y depósito actuales como estimación previa y los suma como strings decimales con aritmética entera, sin punto flotante. Estos valores no forman parte de la solicitud: `POST /api/reservaciones` recibe exclusivamente `clienteId`, `sucursalId`, `vestidoIds`, fechas ISO 8601 con zona, notas y `confirmar`. El backend conserva la autoridad sobre estado, snapshots, importes, totales, tenant y disponibilidad.

`confirmar=true` es la opción predeterminada; también se puede guardar como `BORRADOR`. Ante un conflicto `409`, la pantalla conserva cliente, sucursal, rango y notas, consulta nuevamente la disponibilidad, descarta únicamente piezas que dejaron de estar libres y solicita revisar la selección. El botón permanece bloqueado mientras la creación está pendiente para evitar solicitudes duplicadas.

### Edición y ciclo de vida

`/app/reservaciones/:id/editar` permite a `OWNER` y `EMPLOYEE` modificar cliente, sucursal, rango, vestidos y notas únicamente cuando el estado vigente es `BORRADOR` o `CONFIRMADA`. La página vuelve a consultar disponibilidad, conserva por separado los snapshots históricos de piezas existentes y aclara que cada pieza nueva tomará los importes actuales al incorporarse. El `PATCH` no contiene estado, importes, totales ni selectores tenant.

El detalle ofrece acciones explícitas, sin selector genérico:

| Estado     | OWNER                | EMPLOYEE     |
| ---------- | -------------------- | ------------ |
| BORRADOR   | Confirmar o cancelar | Confirmar    |
| CONFIRMADA | Entregar o cancelar  | Entregar     |
| ENTREGADA  | Devolver             | Devolver     |
| DEVUELTA   | Sin acciones         | Sin acciones |
| CANCELADA  | Sin acciones         | Sin acciones |

Cada acción abre una confirmación y queda deshabilitada mientras se procesa. Cancelar acepta un motivo opcional de hasta 1,000 caracteres y solamente se muestra a `OWNER`. Después de cualquier transición exitosa se descarta su respuesta como fuente de estado y se vuelve a consultar `GET /api/reservaciones/:id`. Un `409` concurrente realiza la misma recarga y muestra el estado autoritativo del servidor; un `403` no modifica el detalle local.

Estas pantallas no implementan pagos, daños ni reembolsos.

## Auditoría y endurecimiento frontend

La aplicación mantiene el access token exclusivamente en `AccessTokenStore`, una signal en memoria. El refresh token continúa siendo una cookie HttpOnly administrada por el navegador y ningún servicio intenta leerla. `localStorage` conserva únicamente la preferencia no autoritativa `vestidos_empresa_id`; no almacena tokens, roles ni nombres de schemas.

`ApiClient` rechaza URLs absolutas, rutas con nombres internos de tenant y query parameters `empresaId`, `empresaSlug` o `schemaName`. La única selección de empresa permitida continúa siendo `POST /auth/select-empresa` mediante un cuerpo tipado con `empresaId`. Los errores visibles se derivan del código HTTP y usan mensajes del dominio: `403` representa pérdida de acceso o permisos y `404` conserva la semántica de recurso inexistente o ajeno sin revelar detalles internos.

Todos los stores con datos tenant se registran en `TenantResetRegistry`, cancelan solicitudes pendientes y limpian su estado antes de cambiar de empresa. Los listados limitan `limit` a 100, conservan filtros válidos en la URL, ignoran respuestas obsoletas y usan IDs o rutas estables en `@for`. Los importes permanecen como strings decimales y las fechas locales se convierten a ISO 8601 mostrando la zona IANA utilizada.

ESLint utiliza las configuraciones recomendadas de TypeScript y Angular, incluyendo reglas de accesibilidad para templates. Playwright ejecuta recorridos contra un API interceptado en memoria: no necesita credenciales, PostgreSQL ni información real. Sus fixtures usan exclusivamente dominios `.test` y tokens ficticios.

Los recorridos e2e cubren:

- login, selección automática de empresa, catálogo y logout;
- creación de cliente;
- disponibilidad con zona horaria;
- creación confirmada de reservación;
- ciclo confirmar → entregar → devolver;
- cancelación por `OWNER` y rechazo forzado para `EMPLOYEE`;
- navegación móvil, teclado, foco y cierre con `Escape`.

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
npm run lint --workspace=web
npm run test --workspace=web
npm run test:e2e --workspace=web
```

La aplicación se sirve en <http://localhost:4200>. El e2e inicia su propio servidor Angular y Chromium, intercepta el API y genera trazas o capturas únicamente al fallar. Prettier puede comprobarse con:

```bash
npx prettier --check "apps/web/**/*.{ts,html,css,json,md}"
```
