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

| Ruta                   | Propósito                          |
| ---------------------- | ---------------------------------- |
| `/`                    | Página pública existente           |
| `/login`               | Placeholder del futuro acceso      |
| `/seleccionar-empresa` | Placeholder de selección de tenant |
| `/app`                 | Placeholder del área privada       |

La infraestructura de autenticación ya restaura la sesión desde la cookie HttpOnly y mantiene el access token únicamente en memoria. Todavía no existen formulario de login, guards de rutas ni selección real de empresa.

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
- `AuthStateService` expone `status`, `user`, `error`, `isChecking` e `isAuthenticated` como signals de solo lectura;
- `authInterceptor` agrega Bearer únicamente a solicitudes del API configurado;
- el inicializador de la aplicación intenta restaurar la sesión mediante la cookie HttpOnly antes de completar el arranque.

Login, refresh y logout utilizan `withCredentials=true`. El refresh token nunca está disponible para Angular. No se utilizan `localStorage`, `sessionStorage`, IndexedDB ni cookies accesibles desde JavaScript para persistir tokens.

Ante un `401` de una solicitud protegida, el interceptor comparte una sola rotación entre consumidores concurrentes y reintenta una vez con el access token nuevo. Login, refresh y perfil están excluidos del reintento para evitar ciclos. Un refresh rechazado limpia inmediatamente la identidad y el access token locales.

## Convenciones para features

- Crear componentes standalone dentro de `features/<dominio>`.
- Mantener acceso HTTP y estado de dominio en servicios del feature; los componentes coordinan la vista.
- Usar signals para estado local y derivado.
- Reutilizar `ApiClient`, `ApiError` y los componentes de `shared/ui`.
- No enviar `schemaName` ni construir rutas con nombres de schemas; el tenant se resolverá mediante la autenticación.
- No leer ni persistir manualmente tokens; consumir `AuthStateService` y dejar el header Bearer al interceptor.
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
