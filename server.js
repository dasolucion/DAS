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
        // TFHKA Venezuela espera los campos con mayúscula inicial y a veces el RIF
        const response = await axios.post(urlFinal, {
            Usuario: process.env.TFHKA_USER ? process.env.TFHKA_USER.trim() : "",
            Clave: process.env.TFHKA_PASS ? process.env.TFHKA_PASS.trim() : "",
            RIF: process.env.TFHKA_RIF ? process.env.TFHKA_RIF.trim() : "J-860043237" // <-- Tu RIF
        });

        // Extracción segura del token
        let rawToken = response.data;
        if (rawToken && typeof rawToken === 'object') {
            rawToken = rawToken.token || rawToken.Token || rawToken.access_token || (rawToken.data ? rawToken.data.token : null);
        }
        tokenCache = String(rawToken);
        tokenExpiry = Date.now() + (11 * 60 * 60 * 1000);
        
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

        let urlBase = process.env.TFHKA_URL ? process.env.TFHKA_URL.trim() : "https://demoemisionv2.thefactoryhka.com.ve";
        const urlEmision = `${urlBase}/api/Emision`;

        const payloadFinal = {
            ...payloadJSON,
            Usuario: process.env.TFHKA_USER ? process.env.TFHKA_USER.trim() : "",
            Clave: process.env.TFHKA_PASS ? process.env.TFHKA_PASS.trim() : ""
        };

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': token // Sin 'Bearer' según pruebas anteriores
        };

        console.log("📤 Enviando factura a TFHKA...");
        const response = await axios.post(urlEmision, payloadFinal, { headers });

        res.status(200).json(response.data);

    } catch (error) {
        console.error("❌ ERROR DETALLADO DE TFHKA:", error.response?.data || error.message);
        res.status(error.response?.status || 500).json(
            error.response?.data || { mensaje: error.message || "Error interno procesando la factura" }
        );
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
});
