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

    // Usamos la URL oficial del entorno Demo (con v2)
    const urlBase = process.env.TFHKA_URL ? process.env.TFHKA_URL.trim() : "https://demoemisionv2.thefactoryhka.com.ve";
    const urlFinal = `${urlBase}/api/Autenticacion`;
    
    // Limpiamos las credenciales
    const user = process.env.TFHKA_USER ? process.env.TFHKA_USER.trim() : "";
    const pass = process.env.TFHKA_PASS ? process.env.TFHKA_PASS.trim() : "";

    const bodyAutenticacion = {
        usuario: user,
        clave: pass
    };

    console.log("🔍 Autenticando en:", urlFinal);
    console.log("📤 Body enviado:", JSON.stringify(bodyAutenticacion));

    try {
        const response = await axios.post(urlFinal, bodyAutenticacion, {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        console.log("📥 Respuesta de Autenticación:", JSON.stringify(response.data));

        let rawToken = response.data;
        if (rawToken && typeof rawToken === 'object') {
            rawToken = rawToken.token || rawToken.Token || rawToken.access_token;
        }
        
        if (!rawToken) {
            throw new Error("El servidor no devolvió un token válido.");
        }

        tokenCache = String(rawToken);
        tokenExpiry = Date.now() + (11 * 60 * 60 * 1000); // 11 horas
        
        console.log("✅ Token obtenido correctamente.");
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

        const urlBase = process.env.TFHKA_URL ? process.env.TFHKA_URL.trim() : "https://demoemisionv2.thefactoryhka.com.ve";
        const urlEmision = `${urlBase}/api/Emision`;

        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${token}`
        };

        console.log("📤 Enviando factura a TFHKA...");
        const response = await axios.post(urlEmision, payloadJSON, { headers });

        console.log("✅ Respuesta de Emisión:", JSON.stringify(response.data));
        res.status(200).json(response.data);

    } catch (error) {
        console.error("❌ ERROR DETALLADO DE TFHKA:", error.response?.data || error.message);
        
        if (error.response?.status === 401 || error.response?.status === 403 || error.response?.data?.codigo === '203') {
            tokenCache = null;
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
