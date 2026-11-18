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

Todavía no existen autenticación frontend, almacenamiento de tokens, interceptores, guards ni selección real de empresa.

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

## Convenciones para features

- Crear componentes standalone dentro de `features/<dominio>`.
- Mantener acceso HTTP y estado de dominio en servicios del feature; los componentes coordinan la vista.
- Usar signals para estado local y derivado.
- Reutilizar `ApiClient`, `ApiError` y los componentes de `shared/ui`.
- No enviar `schemaName` ni construir rutas con nombres de schemas; el tenant se resolverá mediante la autenticación.
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
