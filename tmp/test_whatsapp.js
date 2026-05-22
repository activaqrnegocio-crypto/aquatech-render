const dotenv = require('dotenv');
const path = require('path');

// Cargar variables de entorno desde el .env del proyecto
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const ACCESS_TOKEN = process.env.META_WA_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.META_WA_PHONE_NUMBER_ID;
const RECIPIENT_PHONE = '593967491847';

async function sendWhatsAppTest() {
  console.log('--- Iniciando Prueba de Envío de WhatsApp (Meta Cloud API) ---');
  console.log(`Enviando a: ${RECIPIENT_PHONE}`);
  console.log(`Phone Number ID: ${PHONE_NUMBER_ID}`);

  const url = `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`;

  const data = {
    messaging_product: 'whatsapp',
    to: RECIPIENT_PHONE,
    type: 'template',
    template: {
      name: 'hello_world',
      language: {
        code: 'en_US'
      }
    }
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (response.ok) {
      console.log('✅ ¡Mensaje enviado con éxito!');
      console.log('Respuesta de Meta:', JSON.stringify(result, null, 2));
    } else {
      console.log('❌ Error al enviar el mensaje.');
      console.error('Detalle del error:', JSON.stringify(result, null, 2));
    }
  } catch (error) {
    console.error('💥 Error de conexión:', error.message);
  }
}

sendWhatsAppTest();
