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

    let urlBase = process.env.TFHKA_URL ? process.env.TFHKA_URL.trim() : "https://demoemisionv2.thefactoryhka.com.ve";
    const urlFinal = `${urlBase}/api/Autenticacion`;
    console.log("🔍 Conectando a:", urlFinal);

    try {
        const response = await axios.post(urlFinal, {
            usuario: process.env.TFHKA_USER ? process.env.TFHKA_USER.trim() : "",
            clave: process.env.TFHKA_PASS ? process.env.TFHKA_PASS.trim() : ""
        });

        // EXTRACCIÓN SEGURA DEL TOKEN
        let rawToken = response.data;
        if (rawToken && typeof rawToken === 'object') {
            rawToken = rawToken.token || rawToken.Token || rawToken.access_token || (rawToken.data ? rawToken.data.token : null);
        }
        tokenCache = String(rawToken);
        tokenExpiry = Date.now() + (11 * 60 * 60 * 1000);
        
        console.log("✅ Token obtenido:", tokenCache.substring(0, 20) + "...");
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

        // Inyectamos credenciales en el body por si la API las requiere a nivel raíz
        const payloadFinal = {
            ...payloadJSON,
            usuario: process.env.TFHKA_USER ? process.env.TFHKA_USER.trim() : "",
            clave: process.env.TFHKA_PASS ? process.env.TFHKA_PASS.trim() : ""
        };

        // PRUEBA 1: Enviar el token SIN el prefijo "Bearer " (algunas versiones de TFHKA lo exigen así)
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': token 
        };

        console.log("📤 Enviando a TFHKA...");
        const response = await axios.post(urlEmision, payloadFinal, { headers });

        res.status(200).json(response.data);

    } catch (error) {
        console.error("❌ ERROR DETALLADO DE TFHKA:", error.response?.data || error.message);
        
        // Si falla sin Bearer, intentamos con Bearer como fallback
        if (error.response?.status === 401 || error.response?.status === 403) {
            console.log("🔄 Reintentando con el prefijo 'Bearer'...");
            try {
                const token = await obtenerToken();
                const responseRetry = await axios.post(urlEmision, payloadFinal, {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    }
                });
                return res.status(200).json(responseRetry.data);
            } catch (retryError) {
                console.error("❌ ERROR EN REINTENTO:", retryError.response?.data || retryError.message);
            }
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
