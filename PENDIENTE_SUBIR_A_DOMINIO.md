# Pendiente para subir a dominio real

## 1. capacitor.config.ts
Cambiar `url` al dominio HTTPS real:
```typescript
url: 'https://tudominio.com',
// Quitar puerto personalizado si no aplica
```

## 2. Android network_security_config.xml
Cuando esté en dominio real con HTTPS válido, se puede simplificar a:
```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="false">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
</network-security-config>
```
Ya no necesita el `@raw/mkcert_ca`.

## 3. runners/background.js
Cambiar API URL hardcodeada por la URL real del servidor:
```javascript
const apiUrl = 'https://tudominio.com';
```
Actualmente tiene: `const apiUrl = 'https://178.238.238.158.sslip.io';`

## 4. Limpiar archivos de desarrollo
- `192.168.100.43+2.pem` y `192.168.100.43+2-key.pem` (certificados locales)
- `https-proxy.js` (proxy de desarrollo)
- `android/app/src/main/res/raw/mkcert_ca.der` (CA de desarrollo)

## 5. Archivos que NO requieren cambio
- ✅ `runners/background.js` - La URL cambiará, el resto del código funciona
- ✅ `custom-sw.js` - Usa `self.location.origin` automáticamente
- ✅ `storage.ts` / `native-storage.ts` - Sin cambios necesarios
- ✅ `network_security_config.xml` - Simplificar cuando esté en HTTPS real
