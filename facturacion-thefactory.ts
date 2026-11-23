import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// ==========================================================
// Integración The Factory HKA Venezuela - API Facturación Digital
// Endpoints implementados:
//   POST /api/Autenticacion   -> obtiene / renueva el JWT (válido 12 hrs)
//   POST /api/Emision          -> emite el documento digital
//   POST /api/AplicarRetencion -> aplica comprobante de retención
//   POST /api/Correo/Enviar    -> envía el comprobante (PDF) por correo
//   POST /api/EstadoDocumento  -> consulta el estado del documento
//   POST /api/DescargaArchivo  -> descarga el PDF fiscal (base64)
//
// Variables de entorno requeridas:
//   CRON_SECRET       -> secreto compartido con la app web
//   SUPABASE_URL      -> URL del proyecto Supabase
//   SUPABASE_SERVICE_ROLE_KEY
//   THEFACTORY_USER   -> usuario de la API The Factory
//   THEFACTORY_CLAVE  -> clave de la API The Factory
//   THEFACTORY_URL    -> base URL (default DEMO: https://demoemisionv2.thefactoryhka.com.ve)
//   THEFACTORY_TOKEN  -> token JWT opcional (si no se configuran credenciales)
//
// NOTA: la app usa login local (sin Supabase Auth). Por eso autorizar() acepta
// ademas la anon key / publishable key del proyecto (son claves publicas).
// ==========================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey'
}

const THEFACTORY_URL_DEFAULT = (Deno.env.get('THEFACTORY_URL') || 'https://demoemisionv2.thefactoryhka.com.ve').replace(/\/+$/, '')
const TTL_TOKEN_MS = 12 * 60 * 60 * 1000 // JWT valido por 12 horas

interface CacheToken { key: string; token: string; expiresAt: number }
let cacheToken: CacheToken | null = null

// La configuracion puede venir en cada peticion (bloque "config") para que el
// usuario administre URL/usuario/clave/serie desde Parametros. Si no viene,
// se usan las variables de entorno (compatibilidad con despliegues anteriores).
function baseUrlDe(body: any = {}): string {
  const candidato = body?.config?.url || body?.tfhka_url || Deno.env.get('THEFACTORY_URL') || THEFACTORY_URL_DEFAULT
  return String(candidato).trim().replace(/\/+$/, '')
}

function credencialesDe(body: any = {}) {
  return {
    usuario: String(body?.config?.usuario || body?.tfhka_usuario || Deno.env.get('THEFACTORY_USER') || '').trim(),
    clave: String(body?.config?.clave || body?.tfhka_clave || Deno.env.get('THEFACTORY_CLAVE') || '').trim()
  }
}

function cacheKeyDe(baseUrl: string, usuario: string): string {
  return `${baseUrl}|${usuario}`
}

function sinConfig(body: any): any {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body
  const limpio: any = { ...body }
  delete limpio.config
  delete limpio.tfhka_url
  delete limpio.tfhka_usuario
  delete limpio.tfhka_clave
  delete limpio.tfhka_serie
  return limpio
}

function extraerToken(data: any): string | null {
  const candidatos = [
    data?.token,
    data?.accesoToken,
    data?.accessToken,
    data?.jwt,
    data?.Resultado?.token,
    data?.resultado?.token,
    data?.data?.token
  ]
  for (const c of candidatos) {
    if (typeof c === 'string' && c.trim().length > 0) return c.trim()
  }
  return null
}

// Usa la expiracion real que devuelve la API (normalmente 12 h), con 1 min de margen.
function ttlDesdeExpiracion(expiracion: any): number {
  const fin = expiracion ? Date.parse(String(expiracion)) : NaN
  if (!Number.isNaN(fin)) {
    const ms = fin - Date.now() - 60_000
    if (ms > 0) return Math.min(ms, TTL_TOKEN_MS)
  }
  return TTL_TOKEN_MS
}

async function obtenerToken(body: any = {}): Promise<string> {
  const baseUrl = baseUrlDe(body)
  const { usuario, clave } = credencialesDe(body)
  const key = cacheKeyDe(baseUrl, usuario)
  if (cacheToken && cacheToken.key === key && cacheToken.expiresAt > Date.now()) return cacheToken.token
  if (!usuario || !clave) throw new Error('Faltan usuario y clave de The Factory (configurar en Parámetros o variables de entorno)')

  const res = await fetch(`${baseUrl}/api/Autenticacion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario, clave })
  })
  const data = await res.json().catch(() => ({}))
  const token = extraerToken(data)
  if (!token) throw new Error(`No se pudo obtener el token de The Factory: ${JSON.stringify(data)}`)
  cacheToken = { key, token, expiresAt: Date.now() + ttlDesdeExpiracion(data?.expiracion) }
  return token
}

async function resolverToken(body: any = {}): Promise<string | null> {
  if (body?.accesoToken && typeof body.accesoToken === 'string') return body.accesoToken
  if (body?.token && typeof body.token === 'string') return body.token
  const baseUrl = baseUrlDe(body)
  const { usuario } = credencialesDe(body)
  const key = cacheKeyDe(baseUrl, usuario)
  if (cacheToken && cacheToken.key === key && cacheToken.expiresAt > Date.now()) return cacheToken.token
  // Credenciales propias (usuario/clave) tienen prioridad sobre un token fijo.
  try { return await obtenerToken(body) } catch (_) { /* sigue abajo */ }
  if (Deno.env.get('THEFACTORY_TOKEN')) return Deno.env.get('THEFACTORY_TOKEN')!
  return null
}

function leerJwt(token: string): any | null {
  try {
    const parte = token.split('.')[1]
    if (!parte) return null
    const b64 = parte.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(parte.length / 4) * 4, '=')
    return JSON.parse(atob(b64))
  } catch (_) {
    return null
  }
}

// La app web no crea sesion de Supabase Auth (login local admin/admin123).
// Aceptamos entonces la anon key / publishable keys del propio proyecto: son
// claves publicas y ya viajan en el HTML. Para produccion conviene Supabase Auth.
function esClavePublicaDelProyecto(token: string): boolean {
  const anon = Deno.env.get('SUPABASE_ANON_KEY')
  if (anon && token === anon) return true

  const publishable = Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')
  if (publishable) {
    try {
      const valores = Object.values(JSON.parse(publishable))
      if (valores.some(v => typeof v === 'string' && v === token)) return true
    } catch (_) { /* formato inesperado */ }
  }

  // Fallback: JWT con rol anon emitido por este mismo proyecto.
  const payload = leerJwt(token)
  if (!payload || payload.role !== 'anon') return false
  const ref = (Deno.env.get('SUPABASE_URL') || '').replace(/^https?:\/\//, '').split('.')[0]
  return !ref || payload.ref === ref
}

function noAutorizado(): Response {
  return new Response(
    JSON.stringify({ status: 'Error', codigo: 401, mensaje: 'No autorizado' }),
    { status: 401, headers: corsHeaders }
  )
}

async function autorizar(req: Request): Promise<Response | null> {
  const authHeader = req.headers.get('Authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return noAutorizado()

  const crons = Deno.env.get('CRON_SECRET')
  if (crons && token === crons) return null // acceso interno (cron / funciones)

  if (esClavePublicaDelProyecto(token)) return null // app web (login local)

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    const { data: userData } = await supabase.auth.getUser(token)
    if (userData?.user) return null // token de usuario de Supabase valido
  } catch (_) { /* token invalido o sin conexion, se rechaza */ }

  return noAutorizado()
}

function bearer(token: string): Record<string, string> {
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: { ...corsHeaders, 'Access-Control-Max-Age': '86400' }
    })
  }

  const denied = await autorizar(req)
  if (denied) return denied

  const url = new URL(req.url)
  // En Supabase el pathname llega con el prefijo /functions/v1/<nombre>/...
  // Normalizamos para que /api/... funcione igual invocado con o sin prefijo.
  const rawPath = url.pathname.replace(/\/+$/, '')
  const apiIdx = rawPath.indexOf('/api/')
  const path = apiIdx >= 0 ? rawPath.slice(apiIdx) : rawPath
  const method = req.method

  try {
    // Diagnostico rapido (no expone secretos)
    if (method === 'GET' && (path === '/api/health' || path === '/health' || path === '')) {
      return new Response(
        JSON.stringify({
          status: 'ok',
          thefactory_url: baseUrlDe({}),
          credenciales_configuradas: Boolean(credencialesDe({}).usuario && credencialesDe({}).clave),
          token_cacheado: Boolean(cacheToken?.token),
          endpoints: ['/api/Autenticacion', '/api/Emision', '/api/EstadoDocumento', '/api/DescargaArchivo', '/api/AplicarRetencion', '/api/Correo/Enviar']
        }),
        { status: 200, headers: corsHeaders }
      )
    }

    // --------------------------------------------------------------
    // 1) AUTENTICACION -> genera / renueva el JWT de The Factory
    // --------------------------------------------------------------
    if (method === 'POST' && path === '/api/Autenticacion') {
      const body = await req.json().catch(() => ({}))
      const cred = credencialesDe(body)
      const usuario = body?.usuario || cred.usuario
      const clave = body?.clave || cred.clave
      if (!usuario || !clave) {
        return new Response(
          JSON.stringify({ status: 'Error', codigo: 400, mensaje: 'Usuario y clave son requeridos' }),
          { status: 400, headers: corsHeaders }
        )
      }
      const res = await fetch(`${baseUrlDe(body)}/api/Autenticacion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario, clave })
      })
      const data = await res.json().catch(() => ({}))
      const token = extraerToken(data)
      if (!token) {
        return new Response(
          JSON.stringify({ status: 'Error', codigo: 401, mensaje: data?.mensaje || 'No se pudo autenticar en The Factory', data }),
          { status: 401, headers: corsHeaders }
        )
      }
      cacheToken = { key: cacheKeyDe(baseUrlDe(body), String(usuario).trim()), token, expiresAt: Date.now() + ttlDesdeExpiracion(data?.expiracion) }
      return new Response(
        JSON.stringify({ status: 'ok', token, ...data }),
        { status: 200, headers: corsHeaders }
      )
    }

    // --------------------------------------------------------------
    // 2) EMISION -> envia el documentoElectronico a The Factory
    // --------------------------------------------------------------
    if (method === 'POST' && path === '/api/Emision') {
      const body = await req.json().catch(() => ({}))
      const token = await resolverToken(body)
      if (!token) {
        return new Response(
          JSON.stringify({ status: 'Error', codigo: 500, mensaje: 'No hay token de The Factory disponible' }),
          { status: 500, headers: corsHeaders }
        )
      }
      // Normaliza la clave raiz al nombre que exige la API (documentoElectronico)
      const doc = body?.documentoElectronico || body?.DocumentoElectronico || null
      const payload = doc
        ? { documentoElectronico: doc, ...(body?.adjuntos ? { adjuntos: body.adjuntos } : {}) }
        : sinConfig(body)
      const res = await fetch(`${baseUrlDe(body)}/api/Emision`, {
        method: 'POST',
        headers: bearer(token),
        body: JSON.stringify(payload)
      })
      const data = await res.json().catch(() => ({}))
      return new Response(JSON.stringify(data), { status: res.status, headers: corsHeaders })
    }

    // --------------------------------------------------------------
    // 3) APLICAR RETENCION
    // --------------------------------------------------------------
    if (method === 'POST' && path === '/api/AplicarRetencion') {
      const body = await req.json().catch(() => ({}))
      const token = await resolverToken(body)
      if (!token) {
        return new Response(
          JSON.stringify({ status: 'Error', codigo: 500, mensaje: 'No hay token de The Factory disponible' }),
          { status: 500, headers: corsHeaders }
        )
      }
      const res = await fetch(`${baseUrlDe(body)}/api/AplicarRetencion`, {
        method: 'POST',
        headers: bearer(token),
        body: JSON.stringify(sinConfig(body))
      })
      const data = await res.json().catch(() => ({}))
      return new Response(JSON.stringify(data), { status: res.status, headers: corsHeaders })
    }

    // --------------------------------------------------------------
    // 4) ENVIO DE CORREO
    // --------------------------------------------------------------
    if (method === 'POST' && path === '/api/Correo/Enviar') {
      const body = await req.json().catch(() => ({}))
      const token = await resolverToken(body)
      if (!token) {
        return new Response(
          JSON.stringify({ status: 'Error', codigo: 500, mensaje: 'No hay token de The Factory disponible' }),
          { status: 500, headers: corsHeaders }
        )
      }
      const res = await fetch(`${baseUrlDe(body)}/api/Correo/Enviar`, {
        method: 'POST',
        headers: bearer(token),
        body: JSON.stringify(sinConfig(body))
      })
      const data = await res.json().catch(() => ({}))
      return new Response(JSON.stringify(data), { status: res.status, headers: corsHeaders })
    }

    // --------------------------------------------------------------
    // 5) ESTADO DEL DOCUMENTO
    // --------------------------------------------------------------
    if (method === 'POST' && path === '/api/EstadoDocumento') {
      const body = await req.json().catch(() => ({}))
      const token = await resolverToken(body)
      if (!token) {
        return new Response(
          JSON.stringify({ status: 'Error', codigo: 500, mensaje: 'No hay token de The Factory disponible' }),
          { status: 500, headers: corsHeaders }
        )
      }
      const res = await fetch(`${baseUrlDe(body)}/api/EstadoDocumento`, {
        method: 'POST',
        headers: bearer(token),
        body: JSON.stringify(sinConfig(body))
      })
      const data = await res.json().catch(() => ({}))
      return new Response(JSON.stringify(data), { status: res.status, headers: corsHeaders })
    }

    // --------------------------------------------------------------
    // 6) DESCARGA DEL PDF FISCAL
    // --------------------------------------------------------------
    if (method === 'POST' && path === '/api/DescargaArchivo') {
      const body = await req.json().catch(() => ({}))
      const token = await resolverToken(body)
      if (!token) {
        return new Response(
          JSON.stringify({ status: 'Error', codigo: 500, mensaje: 'No hay token de The Factory disponible' }),
          { status: 500, headers: corsHeaders }
        )
      }
      // La API devuelve el PDF en base64 dentro de "archivo".
      const payload = {
        serie: body?.serie ?? '',
        tipoDocumento: body?.tipoDocumento || '01',
        numeroDocumento: String(body?.numeroDocumento ?? ''),
        ...(body?.tipoArchivo ? { tipoArchivo: body.tipoArchivo } : {})
      }
      const res = await fetch(`${baseUrlDe(body)}/api/DescargaArchivo`, {
        method: 'POST',
        headers: bearer(token),
        body: JSON.stringify(payload)
      })
      const data = await res.json().catch(() => ({}))
      return new Response(JSON.stringify(data), { status: res.status, headers: corsHeaders })
    }

    return new Response(
      JSON.stringify({ status: 'Error', codigo: 404, mensaje: `Endpoint no encontrado: ${method} ${path}` }),
      { status: 404, headers: corsHeaders }
    )
  } catch (e) {
    return new Response(
      JSON.stringify({ status: 'Error', codigo: 500, mensaje: `Error interno: ${String(e)}` }),
      { status: 500, headers: corsHeaders }
    )
  }
})
