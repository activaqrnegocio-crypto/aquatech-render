# Plan: Carga Paginada del Chat (Tipo WhatsApp)

## Objetivo
Optimizar el rendimiento del chat en dispositivos móviles implementando carga perezosa de mensajes, evitando que la RAM se llene y causando reinicios.

---

## Lo que NO se tocará (Funcionalidades intocables)

| Funcionalidad | Estado |
|---------------|--------|
| Envío de mensajes de texto | ❌ Sin cambios |
| Envío de fotos | ❌ Sin cambios |
| Envío de videos | ❌ Sin cambios |
| Envío de notas de voz | ❌ Sin cambios |
| Timestamps de mensajes | ❌ Sin cambios |
| Reacción a mensajes | ❌ Sin cambios |
| Edición/Eliminación de mensajes | ❌ Sin cambios |
| API de mensajes | ❌ Sin cambios |
| Base de datos | ❌ Sin cambios |
| Sincronización offline | ❌ Sin cambios |
| Outbox de mensajes | ❌ Sin cambios |

---

## Lo que se implementará

### 1. Auto-scroll a últimos mensajes
- Al abrir el chat, scroll automático a los mensajes más recientes
- No importa cuántos mensajes haya, siempre ir al final

### 2. Carga perezosa (Infinite Scroll inverso)
- **Página inicial:** Cargar últimos 10 mensajes
- **Scroll arriba (+20):** Cargar siguientes 20 mensajes
- **Scroll arriba (+30):** Cargar siguientes 30 mensajes
- **Scroll arriba (+40):** Cargar siguientes 40 mensajes
- Y así sucesivamente...

### 3. Virtualización de mensajes
- Renderizar SOLO los mensajes visibles en pantalla
- Mensajes fuera de vista NO se renderizan (ahorro de RAM)
- Similar a como funciona WhatsApp

---

## Vistas afectadas

| Vista | Archivo | Cambios |
|-------|---------|---------|
| Admin Chat | `src/components/chat/ProjectChatUnified.tsx` | Carga perezosa + virtualización |
| Operator Chat | `src/components/chat/ProjectChatUnified.tsx` | Mismo componente, sin cambios adicionales |

---

## Implementación técnica

### Herramientas a usar
- **react-window** o **react-virtualized**: Para virtualización (renderizar solo lo visible)
- **Intersection Observer API**: Para detectar cuando el usuario hace scroll arriba y cargar más

### Estructura de datos
```typescript
interface MessagePage {
  messages: Message[]
  hasMore: boolean
  loadMore: () => Promise<void>
}
```

### Flujo de carga
```
[ 1-10 mensajes ] ← Visible en pantalla
[ scroll up ]
[ 11-30 mensajes ] ← Se cargan al hacer scroll
[ scroll up ]
[ 31-60 mensajes ] ← Se cargan al hacer scroll
...
```

---

## Notas importantes

1. **El componente sigue siendo el mismo** (`ProjectChatUnified.tsx`)
2. **La lógica de envío NO cambia** - todo sigue funcionando igual
3. **El estado de mensajes se mantiene** - la paginación es solo visual
4. **Compatibilidad offline** - los mensajes offline siguen funcionando igual

---

## Verificación
Después de implementar, probar:
- [ ] Abrir chat → ¿Va a últimos mensajes?
- [ ] Enviar mensaje de texto → ¿Funciona igual?
- [ ] Enviar foto → ¿Funciona igual?
- [ ] Enviar video → ¿Funciona igual?
- [ ] Enviar nota de voz → ¿Funciona igual?
- [ ] Scroll arriba → ¿Carga más mensajes?
- [ ] Celular con 100+ mensajes → ¿Sin lag/reinicios?
