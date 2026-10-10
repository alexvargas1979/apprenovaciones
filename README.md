# Rehab Atlanta · App Renovaciones

Sistema para analizar compras de viviendas, presupuestar remodelaciones, registrar gastos y evaluar venta o renta en el área metropolitana de Atlanta.

## Tecnología

React 19 y TypeScript; Vinext/Vite; backend en Cloudflare Workers; base de datos D1 (SQLite) con Drizzle; adjuntos en R2. La autenticación actual depende de los encabezados verificados por Sites/ChatGPT.

## Desarrollo

Requiere Node.js >= 22.13.0 y npm.

```sh
npm ci
npm run dev
```

La configuración de almacenamiento está en `vite.config.ts`, el esquema en `db/schema.ts` y las migraciones en `drizzle/`. Un entorno nuevo requiere aplicar las migraciones en orden y configurar el acceso de autenticación correspondiente. No se incluyen datos ni credenciales de producción.

```sh
npx tsc --noEmit
node scripts/test-stories.mjs lib/stories.test.ts
node scripts/test-stories.mjs lib/property-deletion.test.ts
npm run build
```

## Estado

Esta copia incluye los cambios locales de gastos, retiro de ATTOM y eliminación de propiedades con confirmación. La última versión confirmada en Sites es la 14; subir a GitHub no publica automáticamente esos cambios ni migra datos.

- [Plan de desarrollo](docs/Plan_desarrollo_Rehab_Atlanta.md)
- [Seguimiento de historias](docs/Seguimiento_Rehab_Atlanta.md)
- [Retiro de ATTOM y eliminación](docs/Retiro_ATTOM_y_eliminacion_propiedades.md)

Para alojar fuera de Sites se debe adaptar la autenticación y configurar Workers, D1 y R2. No se deben confiar encabezados de identidad enviados directamente por visitantes.

## Contenido de esta copia

Código, dependencias declaradas y lockfile, migraciones, pruebas y documentación. Excluye `.env*`, bases locales, adjuntos reales, `node_modules`, compilados y credenciales. El historial Git previo de Sites no forma parte de esta importación inicial.
