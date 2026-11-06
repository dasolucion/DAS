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

    // URL de Venezuela Demo (NO la de .do)
    let urlBase = process.env.TFHKA_URL ? process.env.TFHKA_URL.trim() : "https://demoemisionv2.thefactoryhka.com.ve";
    const urlFinal = `${urlBase}/api/Autenticacion`;
    
    const user = process.env.TFHKA_USER ? process.env.TFHKA_USER.trim() : "";
    const pass = process.env.TFHKA_PASS ? process.env.TFHKA_PASS.trim() : "";

    console.log("🔍 Autenticando en:", urlFinal);

    try {
        const response = await axios.post(urlFinal, {
            usuario: user,
            clave: pass
        }, {
            headers: { 'Content-Type': 'application/json' }
        });

        // EXTRACCIÓN SEGURA: A veces TFHKA devuelve el token como texto plano, a veces como objeto
        let rawToken = response.data;
        if (rawToken && typeof rawToken === 'object') {
            rawToken = rawToken.token || rawToken.Token || rawToken.access_token || (rawToken.data ? rawToken.data.token : null);
        }
        
        if (!rawToken) {
            console.error("⚠️ Respuesta inesperada de TFHKA:", response.data);
            throw new Error("No se pudo extraer el token.");
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

        // EL TRUCO MAESTRO: Inyectamos el usuario y clave en el body de la factura.
        // Si el token falla, TFHKA usará estas credenciales para validar el documento.
        payloadJSON.usuario = process.env.TFHKA_USER ? process.env.TFHKA_USER.trim() : "";
        payloadJSON.clave = process.env.TFHKA_PASS ? process.env.TFHKA_PASS.trim() : "";

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };

        console.log("📤 Enviando factura con credenciales en el body...");
        const response = await axios.post(urlEmision, payloadJSON, { headers });

        console.log("✅ FACTURA PROCESADA EXITOSAMENTE:", JSON.stringify(response.data));
        res.status(200).json(response.data);

    } catch (error) {
        console.error("❌ ERROR DETALLADO DE EMISIÓN:", error.response?.data || error.message);
        
        if (error.response?.status === 401 || error.response?.status === 403 || error.response?.data?.codigo === '203') {
            tokenCache = null; // Invalidar token
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
