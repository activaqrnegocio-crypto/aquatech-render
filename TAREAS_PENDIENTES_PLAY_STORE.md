# 📋 TAREAS PENDIENTES - GOOGLE PLAY STORE

**Proyecto:** Aquatech CRM  
**Fecha:** 26 Junio 2026

---

## ✅ YA ESTÁ LISTO (no hacer nada)

- [x] Keystore generado → `D:\Abel paginas\Aquatech\Llaves play store\aquatech-release.keystore`
- [x] capacitor.config.ts → apunta al VPS
- [x] network_security_config.xml → actualizado
- [x] build.gradle → firma de release configurada
- [x] offline-fallback.html → URL del VPS
- [x] privacy.html → creado (solo falta subirlo)
- [x] Íconos y splash screens → listos

---

## ⏳ POR HACER

### 1️⃣ SUBIR privacy.html AL VPS

**Archivo:** `privacy.html` (en la raíz del proyecto)

**Pasos:**
1. Abre FileZilla o conecta por SFTP al VPS
2. Navega a la carpeta del proyecto (donde está docker-compose.yml)
3. Sube `privacy.html` a esa carpeta
4. Verifica que funciona: `https://178.238.238.158.sslip.io/privacy.html`

---

### 2️⃣ CREAR CUENTA GOOGLE PLAY CONSOLE

1. Ve a: https://play.google.com/console
2. Click en "Crear cuenta de desarrollador"
3. Paga $25 USD (un solo pago)
4. Completa tu perfil

---

### 3️⃣ TOMAR CAPTURAS DE PANTALLA

**Requisitos:**
- Mínimo 2, máximo 8
- Formato: 16:9 o 9:16 (teléfono)
- Pueden ser emulator o device real

**Qué capturar:**
1. Pantalla de login
2. Dashboard con proyectos
3. Detalle de un proyecto con galería
4. Chat de un proyecto
5. Vista de operador

**Guardar como:** `captura_1.png`, `captura_2.png`, etc.

---

### 4️⃣ CREAR FEATURE GRAPHIC

**Medidas:** 1024 x 500 px

**Ideas:**
- Fondo azul (#036BB2)
- Logo Aquatech al centro
- Texto: "Aquatech CRM - Gestión de Proyectos"
- Teléfono mostrando la app

**Guardar como:** `feature_graphic.png`

---

### 5️⃣ ESCRIBIR DESCRIPCIONES

**Descripción corta** (máx 80 caracteres):
```
CRM de proyectos hidráulicos para equipos de campo
```

**Descripción larga** (máx 4000 caracteres):
```
Aquatech CRM es una aplicación diseñada para gestionar proyectos de instalación hidráulica y construcción. 

Permite a equipos de campo:
• Registrar avances con fotos, videos y notas de voz
• Chat en tiempo real entre administradores y operadores
• Sincronización offline - trabaja sin internet y sincroniza después
• GPS para registrar ubicación de trabajos
• Gestión completa de proyectos y clientes

Ideal para empresas de:
- Instalación de piscinas
- Sistemas de riego
- Agua potable
- Mantenimiento hidráulico
- Construcción en general

La aplicación permite funcionar offline y sincroniza automáticamente cuando hay conexión a internet, garantizando que ningún dato se pierda.
```

---

### 6️⃣ HACER BUILD DEL AAB

**Comandos a ejecutar:**

```powershell
# 1. Sincronizar cambios web → Android
npx cap sync android

# 2. Generar App Bundle
cd android
.\gradlew bundleRelease
```

**Ubicación del archivo generado:**
```
android\app\build\outputs\bundle\release\app-release.aab
```

---

### 7️⃣ SUBIR A GOOGLE PLAY CONSOLE

1. Crear nueva app
2. Completar "Ficha de la tienda":
   - Nombre: `Aquatech CRM`
   - Categoría: Productividad
   - Icono: `public/icon-512.png`
   - Capturas de pantalla: las que tomaste
   - Feature graphic: el que creaste
   - Descripción corta
   - Descripción larga
3. En "Política de privacidad" poner:
   ```
   https://178.238.238.158.sslip.io/privacy.html
   ```
4. Completar "Clasificación de contenido" (cuestionario)
5. En "Precio y distribución" → definir si es gratis o de pago
6. Subir el archivo `.aab`
7. Enviar a revisión

---

## 📁 ARCHIVOS IMPORTANTES

| Archivo | Ubicación |
|---------|-----------|
| Keystore | `D:\Abel paginas\Aquatech\Llaves play store\aquatech-release.keystore` |
| Contraseñas | `D:\Abel paginas\Aquatech\Llaves play store\README.txt` |
| AAB (cuando se genere) | `android\app\build\outputs\bundle\release\app-release.aab` |
| Privacy HTML | `privacy.html` (raíz del proyecto) |

---

## ⏱️ TIEMPO ESTIMADO

| Tarea | Tiempo |
|-------|--------|
| Subir privacy.html | 5 min |
| Capturas de pantalla | 15 min |
| Feature graphic | 10 min |
| Descripciones | 10 min |
| Build AAB | 10-20 min |
| Play Console | 30 min |

**Total estimado:** ~1.5 horas
