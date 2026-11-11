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

## Crear un tenant

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
```

Los scripts se ejecutan desde la raíz y delegan a cada workspace cuando corresponde.
