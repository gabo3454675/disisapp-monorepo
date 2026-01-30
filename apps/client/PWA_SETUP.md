# Configuración PWA - Instalación como App

## 📱 Estado Actual

El sistema está configurado como PWA (Progressive Web App) y permite instalarse como aplicación nativa en dispositivos móviles y desktop.

## ✅ Funcionalidades Implementadas

1. **Manifest.json** - Configurado con todos los metadatos necesarios
2. **Service Worker** - Generado automáticamente por next-pwa
3. **Componente de Instalación** - Banner flotante que aparece cuando es posible instalar
4. **Meta Tags** - Configurados para iOS, Android y Desktop
5. **Modo Standalone** - La app se abre sin barra del navegador

## 🎨 Iconos Requeridos

Para que la instalación funcione completamente, necesitas crear estos iconos en `apps/client/public/`:

- `icon-192x192.png` (192x192 píxeles)
- `icon-512x512.png` (512x512 píxeles)

### Generar Iconos

Puedes usar herramientas online como:
- https://www.pwabuilder.com/imageGenerator
- https://realfavicongenerator.net/
- https://favicon.io/

O crear manualmente:
1. Crea un logo cuadrado (512x512 mínimo)
2. Redimensiona a 192x192 y 512x512
3. Guarda como PNG en `apps/client/public/`

## 🚀 Cómo Funciona

### En Desktop (Chrome/Edge)
1. El usuario visita la página
2. Aparece un banner en la esquina inferior derecha: "Instalar como App"
3. Al hacer clic, aparece el prompt nativo del navegador
4. El usuario acepta y la app se instala

### En Mobile (Android)
1. El usuario visita la página
2. Aparece un banner flotante: "Instalar como App"
3. Al hacer clic, se abre el prompt de instalación
4. La app se agrega a la pantalla de inicio

### En iOS (Safari)
1. El usuario visita la página
2. Toca el botón "Compartir" (cuadrado con flecha)
3. Selecciona "Agregar a pantalla de inicio"
4. La app se agrega como icono

## 📋 Requisitos para Instalación

- HTTPS (en producción) o localhost (en desarrollo)
- Service Worker registrado
- Manifest.json válido
- Al menos un icono de 192x192

## 🔧 Configuración Actual

- **next-pwa**: Configurado y activo
- **Display Mode**: `standalone` (sin barra del navegador)
- **Orientación**: `any` (portrait y landscape)
- **Theme Color**: `#3b82f6` (azul)
- **Background Color**: `#ffffff` (blanco)

## 📝 Notas

- El PWA está deshabilitado en desarrollo (`disable: process.env.NODE_ENV === 'development'`)
- Para probar en desarrollo, cambia `disable: false` en `next.config.js`
- El banner de instalación solo aparece una vez (se guarda en localStorage)
- El banner no aparece si la app ya está instalada
