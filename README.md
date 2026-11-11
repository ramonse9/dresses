# Dresses SaaS

Base de un SaaS multi-tenant para negocios de renta de vestidos. Este primer alcance contiene solamente la aplicación web y un API con health check; todavía no incluye módulos de negocio, autenticación ni conexión a base de datos.

## Tecnologías

- Angular 22 standalone
- Tailwind CSS 4
- NestJS 12 con TypeScript
- npm workspaces
- PostgreSQL y TypeORM se integrarán en una etapa posterior

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

## Instalación

Desde la raíz del proyecto:

```bash
npm install
```

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
- Health check: <http://localhost:3000/api/health>

El API acepta solicitudes CORS de `http://localhost:4200` y `http://127.0.0.1:4200` durante el desarrollo local.

## Validaciones

```bash
npm run build
npm test
npm run lint
```

Los scripts se ejecutan desde la raíz y delegan a cada workspace cuando corresponde.
