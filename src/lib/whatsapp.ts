/**
 * Servicio de integración con Evolution API para envío de mensajes de WhatsApp.
 */

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const EVOLUTION_INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME;

export async function sendWhatsAppMessage(phone: string, message: string, attachments?: Array<{type: string; name: string; data: string}>) {
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE_NAME) {
    console.error('WhatsApp Service: Faltan credenciales de Evolution API en .env');
    return { success: false, error: 'Configuración incompleta' };
  }

  // Limpiar el número de teléfono (solo dígitos)
  const cleanPhone = phone.replace(/\D/g, '');

  // Envío del mensaje de texto
  try {
    const textResp = await fetch(
      `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE_NAME}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: EVOLUTION_API_KEY,
        },
        body: JSON.stringify({ number: cleanPhone, text: message }),
      }
    );
    if (!textResp.ok) {
      const err = await textResp.text();
      console.error('Evolution API Text Error:', err);
      return { success: false, error: 'Error enviando texto' };
    }
  } catch (e: any) {
    console.error('WhatsApp Service Text Exception:', e.message);
    return { success: false, error: e.message };
  }

  // Si hay adjuntos, enviarlos uno a uno usando el endpoint de media
  if (attachments && attachments.length) {
    for (const att of attachments) {
      try {
        // Mapeo de mediatype para Evolution API
        let mediaType = att.type;
        if (mediaType === 'application') mediaType = 'document';
        if (!['image', 'video', 'audio', 'document'].includes(mediaType)) {
          mediaType = 'document'; // Fallback seguro
        }

        // WhatsApp solo acepta PTT para formatos nativos (ogg/opus)
        const isNativeAudio = att.name.toLowerCase().endsWith('.ogg') || att.name.toLowerCase().endsWith('.opus');
        const isAudio = mediaType === 'audio';
        
        const fileResp = await fetch(
          `${EVOLUTION_API_URL}/message/sendMedia/${EVOLUTION_INSTANCE_NAME}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: EVOLUTION_API_KEY,
            },
            body: JSON.stringify({
              number: cleanPhone,
              mediatype: mediaType,
              media: att.data, 
              fileName: att.name,
              ptt: isAudio && isNativeAudio // Solo PTT si es formato nativo
            }),
          }
        );
        if (!fileResp.ok) {
          const err = await fileResp.text();
          console.error('Evolution API Media Error:', err);
        }
      } catch (e: any) {
        console.error('WhatsApp Service Media Exception:', e.message);
      }
      // Pequeño retardo de 500ms para asegurar el orden en la cola de WhatsApp
      await new Promise(res => setTimeout(res, 500));
    }
  }

  return { success: true };
}
