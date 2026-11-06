const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

let tokenCache = null;
let tokenExpiry = null;

async function obtenerToken() {
    if (tokenCache && Date.now() < tokenExpiry) {
        return tokenCache;
    }

    // URLs para Venezuela
    let urlBase = process.env.TFHKA_URL ? process.env.TFHKA_URL.trim() : "https://demoemisionv2.thefactoryhka.com.ve";
    const urlFinal = `${urlBase}/api/Autenticacion`;
    console.log("🔍 Autenticando en:", urlFinal);

    try {
        // TFHKA Venezuela espera 'usuario' y 'clave' en minúsculas para el token
        const response = await axios.post(urlFinal, {
            usuario: process.env.TFHKA_USER ? process.env.TFHKA_USER.trim() : "",
            clave: process.env.TFHKA_PASS ? process.env.TFHKA_PASS.trim() : ""
        });

        // Log para ver la respuesta exacta de la autenticación
        console.log("📥 Respuesta de Autenticación:", JSON.stringify(response.data));

        // Extracción robusta del token (maneja { token: "..." } o { Token: "..." })
        let rawToken = response.data;
        if (rawToken && typeof rawToken === 'object') {
            rawToken = rawToken.token || rawToken.Token || rawToken.access_token;
        }
        tokenCache = String(rawToken);
        tokenExpiry = Date.now() + (11 * 60 * 60 * 1000);
        
        console.log("✅ Token obtenido (primeros 20 caracteres):", tokenCache.substring(0, 20));
        return tokenCache;
    } catch (error) {
        console.error("❌ ERROR DE AUTENTICACIÓN:", error.response?.data || error.message);
        throw error; 
    }
}

app.post('/api/emitir-factura', async (req, res) => {
    try {
        const payloadJSON = req.body;
        const token = await obtenerToken();

        let urlBase = process.env.TFHKA_URL ? process.env.TFHKA_URL.trim() : "https://demoemisionv2.thefactoryhka.com.ve";
        const urlEmision = `${urlBase}/api/Emision`;

        // ⚠️ IMPORTANTE: NO incluimos 'usuario' ni 'clave' en el cuerpo de la factura.
        // La autenticación se hace SOLO con el token en el header.
        
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` // Volvemos a usar 'Bearer' que es el estándar
        };

        console.log("📤 Enviando factura a TFHKA...");
        const response = await axios.post(urlEmision, payloadJSON, { headers });

        // Log de la respuesta exitosa
        console.log("✅ Respuesta de Emisión:", JSON.stringify(response.data));
        res.status(200).json(response.data);

    } catch (error) {
        console.error("❌ ERROR DETALLADO DE TFHKA:", error.response?.data || error.message);
        
        // Si el token falla, forzamos una re-autenticación en el próximo intento
        if (error.response?.status === 401 || error.response?.status === 403 || error.response?.data?.codigo === '203') {
            tokenCache = null;
            console.log("🔄 Token invalidado. Se reintentará en la próxima petición.");
        }

        res.status(error.response?.status || 500).json(
            error.response?.data || { mensaje: error.message || "Error interno procesando la factura" }
        );
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
});
