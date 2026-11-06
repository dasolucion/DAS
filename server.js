const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

let tokenCache = null;
let tokenExpiry = null;

// 1. Función para obtener el Token JWT
async function obtenerToken() {
    if (tokenCache && Date.now() < tokenExpiry) {
        return tokenCache;
    }

    let urlBase = process.env.TFHKA_URL ? process.env.TFHKA_URL.trim() : "";
    if (!urlBase) urlBase = "https://demoemisionv2.thefactoryhka.com.ve";

    const urlFinal = `${urlBase}/api/Autenticacion`;
    console.log("🔍 Intentando conectar a la URL:", urlFinal);

    try {
        const response = await axios.post(urlFinal, {
            usuario: process.env.TFHKA_USER ? process.env.TFHKA_USER.trim() : "",
            clave: process.env.TFHKA_PASS ? process.env.TFHKA_PASS.trim() : ""
        });

        // EXTRACCIÓN ROBUSTA DEL TOKEN (Evita el error [object Object])
        let rawToken = response.data;
        if (rawToken && typeof rawToken === 'object') {
            rawToken = rawToken.token || rawToken.Token || rawToken.access_token || (rawToken.data ? rawToken.data.token : null);
        }
        tokenCache = String(rawToken);
        tokenExpiry = Date.now() + (11 * 60 * 60 * 1000);
        
        console.log("✅ Token de TFHKA obtenido correctamente.");
        return tokenCache;
    } catch (error) {
        console.error("❌ ERROR REAL DE AUTENTICACIÓN TFHKA:", error.response?.data || error.message);
        throw error; 
    }
}

// 2. Endpoint para emitir la factura
app.post('/api/emitir-factura', async (req, res) => {
    try {
        const payloadJSON = req.body;
        const token = await obtenerToken();

        let urlBase = process.env.TFHKA_URL ? process.env.TFHKA_URL.trim() : "https://demoemisionv2.thefactoryhka.com.ve";
        const urlEmision = `${urlBase}/api/Emision`;

        // TFHKA a veces exige usuario y clave en el body si el token falla
        // Los inyectamos por si acaso para evitar el error 203
        const payloadFinal = {
            ...payloadJSON,
            usuario: process.env.TFHKA_USER ? process.env.TFHKA_USER.trim() : "",
            clave: process.env.TFHKA_PASS ? process.env.TFHKA_PASS.trim() : ""
        };

        const response = await axios.post(urlEmision, payloadFinal, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

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
    console.log(`🚀 Servidor de facturación corriendo en el puerto ${PORT}`);
});
