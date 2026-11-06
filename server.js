const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Variables para manejar el Token en caché
let tokenCache = null;
let tokenExpiry = null;

// 1. Función para obtener el Token JWT
async function obtenerToken() {
    if (tokenCache && Date.now() < tokenExpiry) {
        return tokenCache;
    }

    // Limpiamos cualquier espacio en blanco que pueda tener la variable en Render
    let urlBase = process.env.TFHKA_URL ? process.env.TFHKA_URL.trim() : "";
    
    // Si por alguna razón la variable está vacía en Render, forzamos la URL correcta
    if (!urlBase) {
        urlBase = "https://demoemisionv2.thefactoryhka.com.ve";
    }

    const urlFinal = `${urlBase}/api/Autenticacion`;
    console.log("🔍 Intentando conectar a la URL:", urlFinal);

    try {
        const response = await axios.post(urlFinal, {
            usuario: process.env.TFHKA_USER ? process.env.TFHKA_USER.trim() : "",
            clave: process.env.TFHKA_PASS ? process.env.TFHKA_PASS.trim() : ""
        });

        tokenCache = response.data.token || response.data.Token || response.data; 
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
        
        // Obtener token válido
        const token = await obtenerToken();

        // Enviar el JSON a TFHKA
        const response = await axios.post(`${process.env.TFHKA_URL}/api/Emision`, payloadJSON, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        // Retornar respuesta al frontend
        res.status(200).json(response.data);

    } catch (error) {
        // Esto imprimirá el error detallado en los logs de Render
        console.error("❌ ERROR DETALLADO DE TFHKA:", error.response?.data || error.message);
        
        // Esto enviará el error real al frontend
        res.status(error.response?.status || 500).json(
            error.response?.data || { mensaje: error.message || "Error interno procesando la factura" }
        );
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor de facturación corriendo en el puerto ${PORT}`);
});
