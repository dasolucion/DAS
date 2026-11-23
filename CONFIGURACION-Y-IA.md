# Configuración del sistema: The Factory + Asistente IA

## 1. Facturación digital (The Factory HKA)

Toda la configuración está en **Parámetros → Facturación Digital — The Factory HKA**:

| Campo | Descripción |
|---|---|
| Módulo activo | Si está desactivado, el sistema no envía documentos a The Factory. |
| URL base | `https://demoemisionv2.thefactoryhka.com.ve` (demo actual). Para producción se reemplaza por la URL definitiva. |
| Usuario | Usuario de la API, suministrado por The Factory. |
| Clave | Clave de la API. Se puede mostrar/ocultar con el botón 👁. |
| Serie | Serie fiscal que se envía en la emisión y en los comprobantes. |

El botón **Probar conexión** valida usuario/clave/URL contra `/api/Autenticacion` sin emitir ningún documento.

Las credenciales se guardan en la tabla `configuracion_sistema` (fila `id = 1`) y se envían en cada petición a la Edge Function `facturacion-thefactory`. Ya no están escritas en el código fuente: para entregar el sistema a otro usuario, basta con que abra Parámetros y coloque su propia URL, usuario, clave y serie.

La Edge Function mantiene como respaldo las variables de entorno `THEFACTORY_URL`, `THEFACTORY_USER` y `THEFACTORY_CLAVE` para despliegues anteriores, y usa un caché de token por `URL + usuario` para no mezclar tenants.

### Cambio a producción
1. Obtener la URL, usuario, clave y serie definitivos de The Factory.
2. Abrir Parámetros, reemplazar los cuatro campos y guardar.
3. Probar conexión. No se requiere modificar `index.html` ni volver a desplegar.

## 2. Asistente IA (Gemini, plan gratuito)

Configuración en **Parámetros → Asistente IA**:

- **API Key de Gemini**: se obtiene gratis en Google AI Studio (`https://aistudio.google.com/app/apikey`).
- **Modelo**: por defecto `gemini-2.5-flash-lite` (plan gratuito). Si el modelo por defecto da error, prueba `gemini-3.5-flash-lite` o el modelo gratuito vigente en Google AI Studio.
- **Módulo activo**: habilita el asistente.
- **Exigir revisión y aprobación**: activado por defecto. Con esta opción, la IA **siempre genera un borrador** y no guarda ni emite nada hasta que el usuario apruebe. Al desactivarla, la IA ejecuta de forma autónoma.

### Registrar una compra desde una foto
1. Abrir **Compras**.
2. En la tarjeta *Registrar compra desde foto (IA)*, seleccionar la imagen o PDF de la factura.
3. Pulsar **Analizar con IA**. Gemini extrae proveedor, fecha, número de factura, número de control, subtotal, exento, IVA y total.
4. Revisar el borrador (todos los campos son editables) y pulsar **Aprobar y guardar compra**. La foto se adjunta automáticamente al bucket `facturas-compras`.

Si la aprobación está desactivada, el paso 4 se ejecuta automáticamente después del análisis.

Los montos se normalizan antes de mostrarlos: se aceptan tanto formatos venezolanos (`64.111,11`) como internacionales (`64,111.11`). Si el total no coincide con base + exento + IVA, el borrador muestra una advertencia para revisar los valores.

### Notas
- La API Key se guarda en `configuracion_sistema` y se usa desde el navegador contra `generativelanguage.googleapis.com`. Para un despliegue multiusuario conviene moverla a una Edge Function proxy.
- La IA de texto/voz para **generar facturas de venta** (borrador → aprobación → emisión) queda para la siguiente fase; la Speech API del navegador es compatible con Chromium y requiere permiso de micrófono.

## SQL
- `SUPABASE-CONFIGURACION-SISTEMA.sql`: tabla de configuración y política RLS.

## Instalar el sistema en otro proyecto (reventa / otro usuario)
1. Crear un proyecto Supabase nuevo y ejecutar los SQL del repositorio (`CONFIGURACION`, `NOTAS-CREDITO`, `COMPRAS`, `STORAGE`, etc.).
2. Desplegar la Edge Function desde una carpeta con `supabase/functions/facturacion-thefactory/index.ts`:
   `supabase functions deploy facturacion-thefactory --no-verify-jwt`
3. Publicar `index.html` y el resto de archivos estáticos (el repositorio incluye `.nojekyll` para servirlos sin Jekyll).
4. Abrir **Parámetros** y cargar la URL, usuario, clave y serie propios; luego **Probar conexión**. No hace falta editar código ni credenciales en el servidor.
5. Para la IA, obtener una API Key de Gemini gratuita y cargarla en **Parámetros → Asistente IA**.
