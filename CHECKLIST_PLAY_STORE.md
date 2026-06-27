# ✅ Checklist Google Play Store - Aquatech CRM

**Fecha:** 26 Junio 2026  
**Estado:** Casi listo para subir a Play Store

---

## 📋 LO QUE YA ESTÁ LISTO ✅

| Requisito | Archivo | Estado |
|-----------|---------|--------|
| Keystore de producción | `D:\Abel paginas\Aquatech\Llaves play store\aquatech-release.keystore` | ✅ Listo |
| capacitor.config.ts (VPS) | `capacitor.config.ts` | ✅ Configurado |
| network_security_config.xml | `android/.../network_security_config.xml` | ✅ Actualizado |
| build.gradle (firma release) | `android/app/build.gradle` | ✅ Configurado |
| Ícono 512x512 | `public/icon-512.png` (512x512px) | ✅ Listo |
| Splash screens | `android/.../res/drawable-*/splash.png` | ✅ Logo Aquatech |
| offline-fallback.html | `android/.../assets/offline-fallback.html` | ✅ URL VPS |

---

## ⚠️ LO QUE FALTA

### 1. Política de Privacidad (OBLIGATORIO)

**¿Qué es?** Documento legal que explica qué datos recopila tu app.

**Opciones:**

#### Opción A: Crear página en tu VPS (RECOMENDADO)
1. Crear archivo `privacy.html` en tu VPS
2. Subirlo a `https://178.238.238.158.sslip.io/privacy`
3. Usar esa URL en Google Play Console

#### Opción B: Generador gratuito
- Ir a: https://www.privacypolicygenerator.info/
- Llenar el formulario
- Obtener la URL o HTML
- Hospedarlo en tu VPS

**Contenido básico que debe incluir:**
- Datos que recopilas (nombre, email, ubicación, fotos)
- Cómo usas los datos
- Cómo los proteges
- Tus datos de contacto (email, teléfono)
- Derechos del usuario (borrar cuenta, etc.)

---

### 2. Recursos Gráficos

| Recurso | Medidas | Estado |
|---------|---------|--------|
| Capturas de pantalla | Mínimo 2, máximo 8 | ❌ Faltan |
| Feature Graphic | 1024 x 500 px | ❌ Falta |

**Capturas de pantalla:** Son imágenes de tu app funcionando (login, proyectos, galería, etc.)

**Feature Graphic:** Imagen promocional que aparece arriba de tu ficha en Play Store.

---

### 3. Textos para la Tienda

| Texto | Límite | Estado |
|-------|--------|--------|
| Descripción corta | 80 caracteres | ❌ Falta |
| Descripción larga | 4000 caracteres | ❌ Falta |

**Ejemplo descripción corta:**
> "CRM de gestión de proyectos hidráulicos para equipos de campo"

**Ejemplo descripción larga:**
> "Aquatech CRM es una aplicación diseñada para gestionar proyectos de instalación hidráulica. Permite a equipos de campo registrar avances, subir fotos y videos, chatear en tiempo real, y sincronizar datos incluso sin conexión a internet. Ideal para empresas de mantenimiento, instalación de piscinas, sistemas de riego y agua potable."

---

### 4. Clasificación de Contenido

Google te hace un cuestionario en Play Console. Según tus respuestas, asigna una edad (+3, +12, +18).

**Tu app probablemente será: +3** (no tiene contenido inapropiado)

---

### 5. Decidir: ¿Gratis o De Pago?

- **Gratis:** Todos pueden descargarla
- **De pago:** Los usuarios pagan para descargarla

---

## 📝 PRÓXIMOS PASOS

### Paso Inmediato: Build del AAB

```powershell
# 1. Sincronizar web → Android
npx cap sync android

# 2. Generar App Bundle (AAB)
cd android
.\gradlew bundleRelease
```

El archivo se genera en:
```
android/app/build/outputs/bundle/release/app-release.aab
```

### Después de tener el AAB:

1. Crear cuenta en [play.google.com/console](https://play.google.com/console) (~$25 USD una vez)
2. Crear nueva app
3. Subir `app-release.aab`
4. Llenar:
   - Ficha de la tienda (nombre, descripción, capturas, iconos)
   - Política de privacidad (URL)
   - Clasificación de contenido
   - Precio y distribución
5. Enviar a revisión

---

## 📁 Archivos Importantes

| Archivo | Ubicación |
|---------|-----------|
| Keystore | `D:\Abel paginas\Aquatech\Llaves play store\aquatech-release.keystore` |
| Contraseñas | `D:\Abel paginas\Aquatech\Llaves play store\README.txt` |
| AAB (cuando se genere) | `android/app/build/outputs/bundle/release/app-release.aab` |
| Este checklist | `CHECKLIST_PLAY_STORE.md` |

---

## ⚠️ IMPORTANTE

- **NO perder el keystore** — Si lo pierdes, no puedes actualizar la app
- **NO compartir las contraseñas** — Mantenerlas seguras
- **Guardar este archivo** — Referencia para el proceso
