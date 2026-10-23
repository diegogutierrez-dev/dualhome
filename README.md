# DualHome — Habitar juntos

Landing page de DualHome: mobiliario y espacios pensados para hogares donde conviven personas y mascotas.

## Tecnología

- [Vite](https://vite.dev) + JavaScript
- [Three.js](https://threejs.org) — mueble de referencia en 3D (modelado por código) y retratos al óleo renderizados con shaders
- [GSAP](https://gsap.com) + ScrollTrigger + SplitText — animaciones ligadas al scroll
- [Lenis](https://lenis.darkroom.engineering) — scroll suave

Diseño adaptado a desktop y móvil. Si el navegador no tiene WebGL, se muestran imágenes estáticas; con "reducir movimiento" activo se desactiva el scroll suave.

## Correr localmente

```bash
npm install
npm run dev
```

## Build de producción

```bash
npm run build
npm run preview
```

El resultado queda en `dist/`.

## Estructura

```
index.html          contenido de la página
src/main.js         scroll, animaciones e interacción
src/style.css       estilos (desktop y móvil)
src/gl/world.js     escena WebGL, cámara y anclaje del mueble a cada sección
src/gl/puf.js       mueble de referencia en 3D
src/gl/media.js     retratos pintados como planos WebGL con revelado de pincel
src/gl/textures.js  texturas procedurales de madera y tela
public/assets/      imágenes de la marca
```

## Pendiente

- El formulario de contacto valida los campos pero no envía los datos a ningún servicio.

---

Daniel Zapata · Gerónimo Quijano — Medellín
