# HU-56 · Acceso con Supabase Auth

10 de octubre de 2026. **En verificación local**. No publicado ni activado en producción.

## Implementado

- Pantallas `/ingresar`, `/recuperar`, `/cuenta` y confirmación explícita de enlaces de correo.
- Acceso por correo/contraseña con correo confirmado, recuperación, aceptación de invitación, nueva contraseña y cierre global de sesiones. No se ofrece registro público.
- Cliente servidor `@supabase/ssr` 0.12.7 y `supabase-js` 2.117.3, versiones fijadas. Cookies HttpOnly, SameSite=Lax, Secure en HTTPS y path raíz. No se entrega la clave privilegiada al runtime de la aplicación ni se guarda la sesión en localStorage.
- `middleware.ts` renueva las cookies y las transmite tanto a la respuesta como al render servidor. La identidad se verifica con `auth.getUser()`; no se confía en `getSession()` ni en metadatos editables para permisos.
- Login, recuperación, verificación, cambio de contraseña y logout requieren POST con Origin coincidente. Retornos restringidos al sitio, respuestas privadas `no-store`, enlaces de correo con `Referrer-Policy: no-referrer`. La confirmación por POST evita que una simple previsualización del correo consuma el enlace.
- Plantillas locales de invitación, recuperación y confirmación. Buzón de prueba Mailpit; ningún correo externo enviado.
- Las páginas y rutas existentes consultan `getAppUser`/`requireAppUser`. Con Supabase activo, los encabezados `oai-authenticated-*` no son fuente de identidad.

## Activación y límites

La configuración predeterminada sigue siendo `sites`. Esto conserva el acceso existente mientras HU-54 resuelve alojamiento y HU-57–60 resuelven identidades, permisos y datos. `app/chatgpt-auth.ts` se mantiene exclusivamente para esa compatibilidad, con eliminación definitiva prevista en HU-68.

Para el ensayo, `.env.local` (ignorado por Git) contiene:

```dotenv
REHAB_AUTH_PROVIDER=supabase
REHAB_APP_ORIGIN=http://127.0.0.1:3000
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_PUBLISHABLE_KEY=<clave publicable local>
```

La clave anon heredada se acepta solo para el stack local. No usar `SERVICE_ROLE_KEY` ni `sb_secret_*` en estas variables. `vite.config.ts` pasa únicamente estas cuatro variables al entorno servidor; no las inyecta como variables públicas del navegador. No empaquetar configuración local para desplegar en producción: preparar el entorno y origen definitivo en HU-54/66.

Al iniciar sesión, `/` y `/equipo` llevan a `/cuenta`. Las API de negocio responden 401 sin sesión y 503 con sesión mientras la persistencia continúa en D1. Existe el mismo bloqueo en la función de identidad del backend como defensa adicional. Esta separación impide escribir datos D1 bajo un UUID nuevo o atribuir propiedades por correo. `/auth/session` sí permite comprobar la sesión de forma autenticada, sin devolver tokens.

El cambio de contraseña cierra sesiones mediante Supabase. Como ocurre normalmente con JWT, un access token previamente copiado puede durar hasta su expiración; invalidar el refresh token no revoca criptográficamente el access token. No se afirma revocación instantánea de todos los tokens. Las operaciones de negocio siguen bloqueadas hasta implementar HU-58/60 y sus controles efectivos.

## Validación realizada

- 22 verificaciones HTTP contra Vinext y Supabase reales locales en `scripts/migration/test-hu56-auth.mjs`.
- Casos: correo no confirmado, encabezado ChatGPT falsificado, página privada sin sesión, origen ajeno, contraseña errónea, cookies HttpOnly/retorno seguro, identidad SSR, sesión servidor/no-cache, bloqueo D1, renovación de sesión y transmisión al render, refresh token inválido, logout, callback PKCE inválido, enlace inválido, enlace de recuperación realmente caducado, correo capturado en Mailpit, recuperación correcta, enlace reutilizado, contraseña débil, cambio de contraseña y rechazo de la anterior, invitación confirmada.
- Usuarios sintéticos con correo `example.invalid`, contraseñas aleatorias en memoria y eliminación al terminar. La prueba de caducidad modifica solo `recovery_sent_at` del usuario sintético en el contenedor local. No modifica usuarios ni configuración remota.
- TypeScript sin errores y compilación de producción completada. Regresión de historias y eliminación de propiedad aprobadas, con el adaptador de identidad simulado actualizado en `scripts/test-stories.mjs`; esas regresiones no sustituyen las 22 pruebas de Auth real.
- Formulario de acceso revisado visualmente en el navegador. No se realizó todavía una revisión visual completa en móviles.

Reproducción desde la raíz, con Docker/Supabase local activos y las variables anteriores:

```sh
npm run dev -- --host 127.0.0.1 --port 3000
# En otra terminal; la CLI se añade al PATH de esta ejecución:
npm exec --yes --package=supabase@2.120.0 -- node scripts/migration/test-hu56-auth.mjs
```

También puede indicarse la ruta de la CLI mediante `SUPABASE_CLI`. La prueba se niega a usar una URL Supabase distinta de `http://127.0.0.1:54321`; la aplicación objetivo está fijada en `http://127.0.0.1:3000`.

## Pendiente para cierre

1. Resolver el alojamiento de HU-54, dominio HTTPS, callbacks de producción y sustitución de la puerta de acceso de Sites sin doble login.
2. Configurar SMTP y plantillas remotas; probar entrega real a destinatarios autorizados. El ensayo local no valida entregabilidad externa.
3. Ensayar PKCE válido de extremo a extremo si se utiliza ese flujo en producción: las plantillas locales usan token hash, validado completamente; el callback PKCE solo tiene prueba negativa.
4. Integrar cuentas existentes y permisos HU-57/58; adaptar persistencia en HU-60 antes de habilitar las API de negocio para Supabase. Probar acceso funcional a propiedades y documentos tras esa integración.
5. No marcar HU-56 completada ni cambiar producción mientras estos puntos sigan pendientes.

Referencias: [SSR de Supabase](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [plantillas de correo](https://supabase.com/docs/guides/auth/auth-email-templates).
