const dotenv = require('dotenv');
const path = require('path');

// Cargar variables de entorno desde el .env del proyecto
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const EVOLUTION_INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME;
const RECIPIENT_PHONE = '593967491847';

async function sendEvolutionTest() {
  console.log('--- Prueba de Envío Evolution API ---');
  console.log(`URL: ${EVOLUTION_API_URL}`);
  console.log(`Instancia: ${EVOLUTION_INSTANCE_NAME}`);
  console.log(`Enviando a: ${RECIPIENT_PHONE}`);

  const url = `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE_NAME}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY
      },
      body: JSON.stringify({
        number: RECIPIENT_PHONE,
        text: '🔵 *Prueba de Sistema Aquatech*\n\n¡Hola! Esta es una prueba de integración exitosa con la API de Evolution. \n\nEl sistema de notificaciones automáticas y recordatorios ya está activo en tu CRM.'
      })
    });

    const result = await response.json();

    if (response.ok) {
      console.log('✅ ¡Mensaje enviado con éxito via Evolution!');
      console.log('Respuesta:', JSON.stringify(result, null, 2));
    } else {
      console.log('❌ Error al enviar el mensaje.');
      console.error('Detalle:', JSON.stringify(result, null, 2));
    }
  } catch (error) {
    console.error('💥 Error de red:', error.message);
  }
}

sendEvolutionTest();
