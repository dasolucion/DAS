const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
// Permite peticiones desde cualquier origen (o puedes poner tu URL de GitHub Pages)
app.use(cors({
    origin: '*' // En producción, puedes cambiar '*' por 'https://tu-usuario.github.io'
}));
app.use(express.json());

// Variables para manejar el Token en caché
let tokenCache = null;
let tokenExpiry = null;

// 1. Función para obtener el Token JWT
async function obtenerToken() {
    // Si el token existe y no ha expirado (dura 12 horas), lo reutilizamos
    if (tokenCache && Date.now() < tokenExpiry) {
        return tokenCache;
    }

    try {
        const response = await axios.post(`${process.env.TFHKA_URL}/api/Autenticacion`, {
            usuario: process.env.TFHKA_USER,
            clave: process.env.TFHKA_PASS
        });

        // Guardamos el token y seteamos expiración en 11 horas para evitar cortes
        tokenCache = response.data.token || response.data.Token || response.data; 
        tokenExpiry = Date.now() + (11 * 60 * 60 * 1000);
        
        console.log("✅ Token de TFHKA obtenido correctamente.");
        return tokenCache;
    } catch (error) {
        console.error("❌ Error de autenticación:", error.response?.data || error.message);
        throw new Error("No se pudo conectar con los servidores de Facturación Digital.");
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
});
