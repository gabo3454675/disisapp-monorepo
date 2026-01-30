# 📱 Configuración de Iconos PWA

## ✅ Archivos Necesarios

Para que la PWA funcione correctamente, necesitas estos iconos en `apps/client/public/`:

### Iconos Mínimos Requeridos:
- `icon-192x192.png` (192x192 píxeles) - **REQUERIDO**
- `icon-512x512.png` (512x512 píxeles) - **REQUERIDO**

### Iconos Opcionales (mejoran la experiencia):
- `icon-72x72.png` (72x72)
- `icon-96x96.png` (96x96)
- `icon-128x128.png` (128x128)
- `icon-144x144.png` (144x144)
- `icon-152x152.png` (152x152) - Para iOS
- `icon-384x384.png` (384x384)

## 🔧 Si tus iconos tienen otros nombres

Si tus archivos tienen nombres diferentes (ej: `logo.png`, `favicon.png`, `app-icon.png`), el manifest ya está configurado para buscarlos también.

**Pero para mejor compatibilidad, renombra tus iconos a:**
- `icon-192x192.png`
- `icon-512x512.png`

## 📝 Verificar que funcionan

1. Abre la app en el navegador
2. Abre las DevTools (F12)
3. Ve a la pestaña "Application" → "Manifest"
4. Verifica que los iconos se carguen sin errores

## 🎨 Generar iconos desde un logo

Si tienes un logo cuadrado, puedes usar:
- https://www.pwabuilder.com/imageGenerator
- https://realfavicongenerator.net/
- https://favicon.io/
