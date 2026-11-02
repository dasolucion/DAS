import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  // CORS: permitir llamadas desde la aplicación web
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  // Manejar preflight (OPTIONS)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const authHeader = req.headers.get('Authorization')
  if (authHeader !== `Bearer ${Deno.env.get('CRON_SECRET')}`) {
    return new Response('No autorizado', { status: 401, headers: corsHeaders })
  }

  const body = await req.json()
  const { cliente_id, descripcion, fecha_vencimiento } = body

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Datos confirmados por el usuario (imágenes de Meta)
  const token = '02c1132253c5df42732ffa3d9d41cee3'; // WHATSAPP_TOKEN
  const phoneNumberId = '2657749114513652';     // WHATSAPP_PHONE_NUMBER_ID
  const templateName = 'orden_servicio_creada';  // WHATSAPP_TEMPLATE_NAME

  let nombreCliente = 'Cliente';
  let telefonoCliente = '';

  if (cliente_id) {
    const { data: cliente } = await supabase
      .from('clientes')
      .select('descripcion, telefono')
      .eq('id', cliente_id)
      .single()
    if (cliente) {
      nombreCliente = cliente.descripcion || 'Cliente';
      telefonoCliente = cliente.telefono || '';
      if (telefonoCliente && !telefonoCliente.startsWith('+')) {
        telefonoCliente = '+58' + telefonoCliente;
      }
    }
  }

  if (!telefonoCliente) {
    return new Response(JSON.stringify({ status: "Error", mensaje: "Cliente sin teléfono registrado" }), { status: 200, headers: corsHeaders })
  }

  const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to: telefonoCliente,
    type: "template",
    template: {
      name: templateName,
      language: { code: "es" },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: nombreCliente },
            { type: "text", text: descripcion || 'Servicio de soporte' },
            { type: "text", text: fecha_vencimiento || 'Próximamente' }
          ]
        }
      ]
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })

  const result = await response.json()

  if (!response.ok) {
    return new Response(JSON.stringify({ status: "Error", meta: result }), { status: 500, headers: corsHeaders })
  }

  return new Response(JSON.stringify({
    status: "Enviado",
    meta: result,
    cliente: nombreCliente,
    servicio: descripcion,
    fecha: fecha_vencimiento,
    telefono: telefonoCliente,
    token: token,
    phoneNumberId: phoneNumberId,
    templateName: templateName
  }), { status: 200, headers: corsHeaders })
})
