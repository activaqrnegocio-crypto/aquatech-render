# Análisis de Duplicados en el Chat - Aquatech CRM

## Problema Detectado

Al intentar enviar dos audios seguidos en el chat (o dos imágenes, videos, documentos, etc.), el segundo mensaje sobrescribe al primero o desaparece (se "pone uno sobre el otro").

## Causa Raíz

En el archivo [useProjectCache.ts](file:///d:/Abel%20paginas/Aquatech/crm%20mayo/aquatech-render-main/src/hooks/useProjectCache.ts), la función `deduplicateMessages` tiene la siguiente lógica para deduplicar mensajes temporales contra mensajes reales o contra otros temporales:

```typescript
const isDuplicate = result.some(rm => {
  if (rm.content !== msg.content || rm.type !== msg.type) return false
  const timeDiff = Math.abs(new Date(rm.createdAt).getTime() - new Date(msg.createdAt).getTime())
  if (timeDiff < 5 * 60 * 1000) return true
  // Content-only fallback for TEXT (no timestamp constraint)
  if (msg.type === 'TEXT' && msg.content?.trim().length > 0) return true
  return false
})
```

### Por qué falla con Audios, Fotos, Videos y Documentos:
1. **Contenido vacío/idéntico:** Los mensajes de tipo `AUDIO`, `IMAGE`, `VIDEO` o `DOCUMENT` usualmente no tienen texto en `content` (o es un string vacío `""` o `undefined`).
2. **Coincidencia de tipo:** Si envías dos audios seguidos, ambos tienen `type: 'AUDIO'` y `content: undefined`. Por lo tanto, `rm.content === msg.content` y `rm.type === msg.type` se evalúan como **verdaderos**.
3. **Ventana de 5 minutos:** Como ambos audios se envían en menos de 5 minutos, la condición `timeDiff < 5 * 60 * 1000` se cumple, por lo que el segundo audio se marca erróneamente como un "duplicado" y es eliminado/ocultado de la lista en pantalla.

### Por qué falla con Texto y Ubicación:
* Si un usuario envía exactamente el mismo mensaje de texto dos veces seguidas dentro de una ventana de 5 minutos (por ejemplo, "Hola" y luego "Hola"), el segundo mensaje también es eliminado por la misma regla de duplicación.

---

## Solución Propuesta

Modificar la lógica de `deduplicateMessages` en [useProjectCache.ts](file:///d:/Abel%20paginas/Aquatech/crm%20mayo/aquatech-render-main/src/hooks/useProjectCache.ts) para que:

1. **No deduplique mensajes temporales entre sí:** Dos mensajes que aún no se han guardado (que tienen IDs tipo `temp-...` o `pending-...`) nunca deben considerarse duplicados entre sí, a menos que compartan el mismo ID único.
2. **Deduplicar archivos multimedia por su nombre de archivo (Filename):** Si el mensaje es de tipo `AUDIO`, `IMAGE`, `VIDEO` o `DOCUMENT`, cada archivo subido tiene un nombre de archivo único (por ejemplo, `audio_1781903952100.webm`). Si los nombres de archivo son diferentes, **no son duplicados**, incluso si se envían en el mismo segundo y tienen el mismo contenido vacío.
3. **Usar `syncId` como clave primaria de deduplicación:** Cuando enviamos un mensaje, generamos un identificador único local (`tempId` / `syncId`). Si guardamos este `syncId` dentro del campo `extraData` del mensaje, cuando la base de datos nos devuelva el mensaje real, podremos compararlo directamente usando `syncId` para saber si es el mismo mensaje que teníamos de forma optimista en la interfaz, sin importar el contenido ni el tiempo.
4. **Reducir la ventana de tiempo para textos idénticos:** Para mensajes de texto sin `syncId`, reducir la ventana de coincidencia a 20 segundos en lugar de 5 minutos, evitando que textos idénticos enviados de manera legítima sean tragados.

---

## Plan de Cambios

### 1. Modificar `deduplicateMessages` en [useProjectCache.ts](file:///d:/Abel%20paginas/Aquatech/crm%20mayo/aquatech-render-main/src/hooks/useProjectCache.ts)
Implementar una deduplicación inteligente que diferencie por filename para multimedia y por `syncId` para todos los mensajes.

### 2. Modificar la creación de mensajes en [ProjectDetailBase.tsx](file:///d:/Abel%20paginas/Aquatech/crm%20mayo/aquatech-render-main/src/components/project/ProjectDetailBase.tsx)
Asegurar que el `syncId` (o `tempId`) se incluya dentro de `extraData` al enviar mensajes para que se guarde en la base de datos y retorne en las consultas de chat.
