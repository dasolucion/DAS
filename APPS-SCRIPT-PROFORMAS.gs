/**
 * DAS - Ingreso automático de proformas de Venezuela Hosting
 * ===========================================================
 * Instalación (en la cuenta Gmail del usuario, una sola vez):
 *
 *  1. Gmail → Configuración → Filtros y direcciones bloqueadas → Crear filtro nuevo:
 *       De:      venezuelahosting.com      (o el correo exacto del remitente)
 *       Asunto:  Proforma Creada
 *       Acción:  Aplicar etiqueta "DAS-Proformas"
 *
 *  2. Extensions → Apps Script → pegar este código → Guardar.
 *
 *  3. Ejecutar UNA vez la función "instalarDisparador" (y autorizar permisos).
 *
 * A partir de ahí, cada 10 minutos el script revisa la etiqueta DAS-Proformas,
 * registra la compra en Supabase, sube el PDF al bucket facturas-compras y
 * marca el correo como DAS-Procesado. Si la proforma ya existe, no la duplica.
 */

const CONFIG = {
  SUPABASE_URL: 'https://frlaldgtcoykntmgxqmh.supabase.co',
  // anon key del proyecto (clave pública, ya está en el index.html del sistema)
  ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZybGFsZGd0Y295a250bWd4cW1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTczNDEsImV4cCI6MjEwMzA5MzM0MX0.lTXPGXldiXSIc8FzKp-pA7t5WJmH6_7e_cwuFHF4TO8',
  BUCKET: 'facturas-compras',
  PROVEEDOR: 'Venezuela Hosting',
  ETIQUETA: 'DAS-Proformas',
  ETIQUETA_PROCESADO: 'DAS-Procesado'
};

function instalarDisparador() {
  const existe = ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'procesarProformas');
  if (!existe) ScriptApp.newTrigger('procesarProformas').timeBased().everyMinutes(10).create();
  Logger.log('Disparador instalado');
}

function procesarProformas() {
  const label = GmailApp.getUserLabelByName(CONFIG.ETIQUETA);
  if (!label) { Logger.log('Falta la etiqueta ' + CONFIG.ETIQUETA); return; }
  let done = GmailApp.getUserLabelByName(CONFIG.ETIQUETA_PROCESADO);
  if (!done) done = GmailApp.createLabel(CONFIG.ETIQUETA_PROCESADO);

  label.getThreads(0, 20).forEach(thread => {
    if (thread.hasLabel(done)) return;
    thread.getMessages().forEach(msg => {
      try {
        if (!/proforma/i.test(msg.getSubject() || '')) return;
        procesarMensaje(msg);
      } catch (e) {
        Logger.log('ERROR: ' + e.message);
      }
    });
    thread.addLabel(done);
    thread.removeLabel(label);
    GmailApp.markThreadRead(thread);
  });
}

function procesarMensaje(msg) {
  const datos = leerDatos(msg.getPlainBody() || '');
  if (!datos.numeroFactura) throw new Error('No se pudo leer el número de proforma');

  const existente = buscarCompra(datos.numeroFactura, datos.fecha, datos.total);
  const idCompra = existente || insertarCompra(datos);

  const adjunto = msg.getAttachments().filter(a =>
    /pdf|jpe?g|png/i.test(a.getContentType() + ' ' + a.getName())
  )[0];
  if (adjunto) subirAdjunto(idCompra, datos, adjunto);
  Logger.log('Proforma ' + datos.numeroFactura + ' -> compra ' + idCompra);
}

/** Lee los datos del cuerpo del correo de Venezuela Hosting. */
function leerDatos(cuerpo) {
  const t = cuerpo.replace(/\r/g, '').replace(/[ \t]+/g, ' ');
  const num = (t.match(/Proforma\s*#\s*:?\s*(\d{3,})/i) || [])[1] || '';

  let fecha = '';
  const f1 = (t.match(/generado\s+el\s+dia\s+(\d{2})\/(\d{2})\/(\d{4})/i) || []);
  const f2 = (t.match(/(\d{2})\/(\d{2})\/(\d{4})/) || []);
  const f = f1.length === 4 ? f1 : f2;
  if (f.length === 4) fecha = `${f[3]}-${f[2]}-${f[1]}`;
  if (!fecha) fecha = new Date().toISOString().split('T')[0];

  return {
    numeroFactura: num,
    fecha: fecha,
    subtotal: monto((t.match(/Subtotal\s*:\s*BsS\.?\s*([\d.,]+)/i) || [])[1]),
    impuestos: monto((t.match(/[\d.]+%\s*IVA\s*Venezuela\s*:\s*BsS\.?\s*([\d.,]+)/i) || [])[1]),
    total: monto((t.match(/(?:^|\n)\s*Total\s*:\s*BsS\.?\s*([\d.,]+)/i) || [])[1])
  };
}

function monto(valor) {
  if (!valor) return 0;
  // 11.814,66 -> 11814.66 ; 13705.01 -> 13705.01
  if (valor.indexOf(',') > -1) return parseFloat(valor.replace(/\./g, '').replace(',', '.')) || 0;
  return parseFloat(valor) || 0;
}

function headers(json) {
  const h = { 'apikey': CONFIG.ANON_KEY, 'Authorization': 'Bearer ' + CONFIG.ANON_KEY };
  if (json) { h['Content-Type'] = 'application/json'; h['Prefer'] = 'return=representation'; }
  return h;
}

/** Evita duplicados: busca por número de proforma o por fecha+total. */
function buscarCompra(numero, fecha, total) {
  let url = CONFIG.SUPABASE_URL + '/rest/v1/compras?select=id&descripcion=ilike.*' + encodeURIComponent(CONFIG.PROVEEDOR) + '*';
  url += '&or=' + encodeURIComponent('numero_factura.eq.' + numero + ',and(fecha.eq.' + fecha + ',total.eq.' + total + ')');
  const res = UrlFetchApp.fetch(url, { headers: headers(false), muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) return null;
  const filas = JSON.parse(res.getContentText());
  return filas.length ? filas[0].id : null;
}

function insertarCompra(datos) {
  const body = {
    descripcion: CONFIG.PROVEEDOR,
    fecha: datos.fecha,
    numero_factura: datos.numeroFactura,
    numero_control: null,
    subtotal: datos.subtotal,
    monto_exento: 0,
    impuestos: datos.impuestos,
    total: datos.total || (datos.subtotal + datos.impuestos),
    es_factura_personal: false
  };
  const res = UrlFetchApp.fetch(CONFIG.SUPABASE_URL + '/rest/v1/compras', {
    method: 'post', headers: headers(true), payload: JSON.stringify([body]), muteHttpExceptions: true
  });
  if (res.getResponseCode() >= 300) throw new Error('Supabase ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 200));
  return JSON.parse(res.getContentText())[0].id;
}

function subirAdjunto(idCompra, datos, adjunto) {
  const nombre = 'factura-' + datos.numeroFactura + '-Venezuela-Hosting.pdf';
  const ruta = 'compras/' + datos.fecha + '/' + nombre;
  const bytes = adjunto.getAs(MimeType.PDF).getBytes().map(b => b < 0 ? b + 256 : b);

  const up = UrlFetchApp.fetch(CONFIG.SUPABASE_URL + '/storage/v1/object/' + CONFIG.BUCKET + '/' + ruta, {
    method: 'post', contentType: 'application/pdf', payload: bytes,
    headers: {
      'apikey': CONFIG.ANON_KEY,
      'Authorization': 'Bearer ' + CONFIG.ANON_KEY,
      'x-upsert': 'true'
    },
    muteHttpExceptions: true
  });
  if (up.getResponseCode() >= 300) {
    Logger.log('No se subió el PDF: ' + up.getResponseCode() + ' ' + up.getContentText().slice(0, 200));
    return;
  }
  const url = CONFIG.SUPABASE_URL + '/storage/v1/object/public/' + CONFIG.BUCKET + '/' + ruta;
  UrlFetchApp.fetch(CONFIG.SUPABASE_URL + '/rest/v1/compras?id=eq.' + idCompra, {
    method: 'patch', headers: headers(true), payload: JSON.stringify({ imagen_url: url }), muteHttpExceptions: true
  });
}
