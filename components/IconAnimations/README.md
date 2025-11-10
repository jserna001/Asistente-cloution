# 🎨 Sistema de Animaciones de Iconos - AnimatedIcon

Sistema completo de animaciones para iconos con GSAP, que combina:
- **Nivel 1**: Animaciones CSS puras (ya implementado en `design-system.css`)
- **Nivel 2**: Componente `AnimatedIcon` con presets GSAP avanzados

---

## 📦 Archivos del Sistema

```
components/
├── AnimatedIcon.tsx              # Componente wrapper principal
├── IconAnimations/
│   ├── gsapPresets.ts            # Configuraciones y funciones GSAP
│   └── README.md                 # Esta documentación
└── Icons.tsx                     # Exporta AnimatedIcon
```

---

## 🚀 Uso Básico

### Importar

```tsx
import { AnimatedIcon, BotIcon } from '@/components/Icons';
```

### Ejemplo Simple

```tsx
<AnimatedIcon animation="bounce" trigger="hover">
  <BotIcon size={24} />
</AnimatedIcon>
```

---

## 🎯 Props del Componente

| Prop | Tipo | Por Defecto | Descripción |
|------|------|-------------|-------------|
| `animation` | `AnimationPreset` | (requerido) | Tipo de animación a aplicar |
| `trigger` | `TriggerType` | `'hover'` | Cuándo activar la animación |
| `children` | `ReactNode` | (requerido) | El icono a animar |
| `className` | `string` | `''` | Clases CSS adicionales |
| `style` | `CSSProperties` | `{}` | Estilos inline |
| `onComplete` | `() => void` | - | Callback al completar |
| `disabled` | `boolean` | `false` | Deshabilitar animación |

---

## 🎬 Presets de Animación

### Básicos

| Preset | Descripción | Uso Recomendado |
|--------|-------------|-----------------|
| `bounce` | Rebote elástico | Confirmaciones, clicks |
| `spin` | Rotación 360° | Recarga, procesando |
| `shake` | Sacudida horizontal | Errores, alertas |
| `pulse` | Pulso de escala | Estados activos, loading |

### Efectos Visuales

| Preset | Descripción | Uso Recomendado |
|--------|-------------|-----------------|
| `glow` | Brillo con drop-shadow | Destacar elementos importantes |
| `float` | Flotación vertical | Estados de espera, idle |
| `swing` | Balanceo desde arriba | Notificaciones, llamadas de atención |
| `wiggle` | Rotación rápida | Errores leves, advertencias |

### Avanzados

| Preset | Descripción | Uso Recomendado |
|--------|-------------|-----------------|
| `heartbeat` | Dos pulsos rápidos | Favoritos, likes |
| `tada` | Escala + rotación celebratoria | Éxitos, logros |
| `flip` | Volteo horizontal | Cambio de estado, toggle |
| `rubberBand` | Estiramiento elástico | Drag & drop, interacciones |

---

## 🎭 Triggers

| Trigger | Descripción | Ejemplo de Uso |
|---------|-------------|----------------|
| `hover` | Al pasar el mouse | Botones, links |
| `click` | Al hacer click | Botones de acción |
| `mount` | Al montar el componente | Entrada de elementos |
| `loop` | Animación continua | Loading, estados activos |
| `none` | Sin trigger automático | Control programático |

---

## 💡 Ejemplos de Uso

### 1. Botón con Bounce al Click

```tsx
<button onClick={handleSubmit}>
  <AnimatedIcon animation="bounce" trigger="click">
    <SendIcon size={20} />
  </AnimatedIcon>
  Enviar
</button>
```

### 2. Loading Indicator con Pulse Loop

```tsx
{isLoading && (
  <AnimatedIcon animation="pulse" trigger="loop">
    <SpinnerIcon size={24} />
  </AnimatedIcon>
)}
```

### 3. Notificación con Swing al Montar

```tsx
<AnimatedIcon animation="swing" trigger="mount">
  <AlertIcon size={20} />
</AnimatedIcon>
```

### 4. Icono Decorativo con Glow Continuo

```tsx
<AnimatedIcon animation="glow" trigger="loop">
  <SparklesIcon size={16} />
</AnimatedIcon>
```

### 5. Botón de Favorito con Heartbeat

```tsx
<AnimatedIcon
  animation="heartbeat"
  trigger="click"
  onComplete={() => console.log('Favorito agregado!')}
>
  <HeartIcon size={20} />
</AnimatedIcon>
```

---

## 🔧 Configuración Avanzada

### Crear Animaciones Personalizadas

Edita `gsapPresets.ts`:

```ts
export const animationFunctions = {
  // ... otros presets

  myCustomAnimation: (element) => {
    const tl = gsap.timeline();
    tl.to(element, { /* tu animación */ });
    return tl;
  },
};
```

### Ajustar Duración y Easing

Edita las configuraciones en `presetConfigs`:

```ts
export const presetConfigs = {
  bounce: {
    duration: 0.8,  // Cambiar de 0.6 a 0.8
    ease: 'elastic.out(1, 0.3)',
  },
};
```

---

## 🎨 Combinación con CSS

Puedes combinar `AnimatedIcon` (GSAP) con clases CSS del Nivel 1:

```tsx
<span className="icon-hover-scale">
  <AnimatedIcon animation="glow" trigger="loop">
    <BotIcon size={24} />
  </AnimatedIcon>
</span>
```

---

## 📊 Cuándo Usar Cada Sistema

### Nivel 1 (CSS) - `design-system.css`

✅ **Usar para:**
- Hover states simples
- Transiciones rápidas
- Animaciones que no requieren programación
- Máximo performance (GPU-accelerated)

Ejemplo:
```tsx
<span className="icon-hover-scale">
  <SettingsIcon size={20} />
</span>
```

### Nivel 2 (GSAP) - `AnimatedIcon`

✅ **Usar para:**
- Animaciones complejas con múltiples pasos
- Timelines y secuencias
- Animaciones con callbacks
- Control programático
- Loops y repeticiones

Ejemplo:
```tsx
<AnimatedIcon animation="tada" trigger="click" onComplete={showSuccess}>
  <CheckIcon size={20} />
</AnimatedIcon>
```

---

## 🚦 Performance

### Optimizaciones Implementadas

1. **Animaciones pausadas por defecto**: Solo se ejecutan cuando se activan
2. **Cleanup automático**: GSAP destruye las animaciones al desmontar
3. **GPU-acceleration**: Usa `transform` y `opacity`
4. **Dependencies tracking**: Solo re-crea animaciones cuando cambian props

### Mejores Prácticas

- ✅ Limita animaciones simultáneas a 3-5 por vista
- ✅ Usa `trigger="loop"` solo cuando sea necesario
- ✅ Prefiere CSS para hover states simples
- ✅ Usa `disabled` prop para deshabilitar en dispositivos lentos

---

## ♿ Accesibilidad

El sistema respeta `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  /* Animaciones CSS se desactivan automáticamente */
}
```

Para GSAP, considera agregar:

```tsx
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

<AnimatedIcon
  animation="bounce"
  trigger="hover"
  disabled={prefersReducedMotion}
>
  <Icon />
</AnimatedIcon>
```

---

## 📝 Ejemplos Implementados en el Proyecto

### Chat (`app/page.tsx`)
```tsx
// Loading indicator con pulse continuo
<AnimatedIcon animation="pulse" trigger="loop">
  <div className="loading-dot" />
</AnimatedIcon>
```

### Login (`app/login/page.tsx`)
```tsx
// SparklesIcon con glow continuo
<AnimatedIcon animation="glow" trigger="loop">
  <SparklesIcon size={14} />
</AnimatedIcon>
```

---

## 🔮 Futuro - Nivel 3

**Posibles mejoras:**
- [ ] Morphing entre iconos (Copy → Check)
- [ ] Partículas y efectos de confeti
- [ ] Integración con Framer Motion
- [ ] Presets de temporada (nieve, fuegos artificiales)
- [ ] Animaciones basadas en física

---

## 📚 Referencias

- [GSAP Docs](https://greensock.com/docs/)
- [GSAP Eases](https://greensock.com/docs/v3/Eases)
- [CSS Animations](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Animations)

---

**Creado**: Nivel 2 - Enero 2025
**Autor**: Sistema de Animaciones Cloution
