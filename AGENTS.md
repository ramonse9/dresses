# Reglas del proyecto

Estas reglas aplican a todo el monorepo, salvo que un `AGENTS.md` más específico establezca instrucciones adicionales para una subcarpeta.

## Arquitectura y tecnologías

- Respetar la arquitectura existente y sus límites entre aplicaciones, módulos y capas.
- Usar Angular standalone y Tailwind CSS en `apps/web`.
- Usar NestJS, TypeORM y PostgreSQL en `apps/api`.
- Mantener el modelo multi-tenant mediante schemas PostgreSQL independientes por tenant.
- Mantener separadas las responsabilidades globales de empresas y las responsabilidades de sucursales dentro de cada tenant.
- No utilizar `synchronize: true` en TypeORM bajo ninguna circunstancia.
- Gestionar todos los cambios de estructura de base de datos mediante migrations.

## Alcance y diseño

- No desarrollar funcionalidades que no hayan sido solicitadas explícitamente.
- Mantener los cambios pequeños, modulares y fáciles de revisar.
- Utilizar nombres, estructura de carpetas y convenciones consistentes con el código existente.
- No modificar archivos ajenos a la tarea.

## Calidad y validación

- Agregar o actualizar pruebas cuando el cambio lo requiera.
- Ejecutar el build y las pruebas correspondientes después de cada cambio.
- Corregir errores o advertencias introducidos por la tarea antes de finalizar.

## Entrega

- Informar los archivos modificados.
- Informar los builds, pruebas y demás validaciones ejecutadas, junto con sus resultados.
- Informar cualquier problema pendiente, limitación o validación que no haya podido completarse.
