# 🎨 Sistema de Animaciones - Documentación Completa

Sistema integral de animaciones para el proyecto, con enfoque en **performance, accesibilidad y experiencia de usuario**.

---

## 📁 Estructura del Proyecto

```
lib/animations/
├── contexts/
│   └── PerformanceMonitor.tsx    # Monitor de rendimiento con overlay visual
├── hooks/
│   └── useReducedMotion.ts       # Hooks de accesibilidad
├── utils/
│   ├── animationOptimizer.ts     # Lazy loading y optimización de GSAP
│   ├── mobileDetector.ts         # Detección de dispositivo y capacidades
│   └── performanceTracker.ts     # Analytics de animaciones
├── orchestration/                 # (Fase 3.2 - Próximamente)
├── microinteractions/             # (Fase 3.3 - Próximamente)
├── index.ts                       # Exports centralizados
└── README.md                      # Esta documentación
```

---

## 🚀 Inicio Rápido

### Instalación

Todo el sistema ya está configurado. Solo necesitas:

```tsx
// En tu app/layout.tsx o _app.tsx
import { PerformanceMonitorProvider } from '@/lib/animations';

export default function RootLayout({ children }) {
  return (
    <PerformanceMonitorProvider
      enableInProduction={false}
      autoAdjust={true}
      targetFPS={30}
    >
      {children}
    </PerformanceMonitorProvider>
  );
}
```

### Uso Básico

```tsx
import { useReducedMotion, usePerformanceMonitor } from '@/lib/animations';
import { AnimatedIcon } from '@/components/Icons';

function MyComponent() {
  const prefersReducedMotion = useReducedMotion();
  const { metrics } = usePerformanceMonitor();

  return (
    <AnimatedIcon
      animation="bounce"
      trigger={prefersReducedMotion ? 'none' : 'hover'}
    >
      <BotIcon size={24} />
    </AnimatedIcon>
  );
}
```

---

## 📦 Módulos

### 1. Performance Monitor (`contexts/PerformanceMonitor.tsx`)

**Funcionalidades:**
- Monitoreo de FPS en tiempo real
- Detección de frames caídos (dropped frames)
- Detección de jank (variación brusca de FPS)
- Tracking de animaciones activas
- Auto-ajuste de rendimiento
- Overlay visual en desarrollo

**API:**

```tsx
// Provider
<PerformanceMonitorProvider
  enableInProduction={false}  // Habilitar en producción
  autoAdjust={true}            // Auto-ajustar si FPS < target
  targetFPS={30}               // FPS objetivo (30 para móvil, 60 para desktop)
>
  {children}
</PerformanceMonitorProvider>

// Hook
const {
  metrics,          // { fps, avgFps, activeAnimations, droppedFrames, isJanky }
  startTracking,    // (id: string) => void
  stopTracking,     // (id: string) => void
  isMonitoring,     // boolean
  toggleMonitoring, // () => void
} = usePerformanceMonitor();

// Hook de tracking automático
useAnimationTracking('my-animation-id', true);
```

**Métricas:**

| Métrica | Descripción | Valor Ideal |
|---------|-------------|-------------|
| `fps` | FPS instantáneo | 60 (desktop), 30 (móvil) |
| `avgFps` | FPS promedio (últimos 60 frames) | 60 (desktop), 30 (móvil) |
| `activeAnimations` | Animaciones activas simultáneas | < 5 |
| `droppedFrames` | Frames caídos desde inicio | < 10 |
| `isJanky` | Variación brusca de FPS | false |

**Overlay Visual (solo desarrollo):**

Aparece automáticamente en la esquina inferior derecha mostrando todas las métricas en tiempo real.

---

### 2. Animation Optimizer (`utils/animationOptimizer.ts`)

**Funcionalidades:**
- Lazy loading de plugins GSAP
- Code splitting de componentes pesados
- Configuración optimizada de GSAP
- Detección de `prefers-reduced-motion`
- Gestión de memoria (cleanup automático)

**API:**

```tsx
// Lazy load de plugins
import { loadScrollTrigger, loadMotionPath } from '@/lib/animations';

await loadScrollTrigger(); // Solo cargar cuando se necesite
await loadMotionPath();

// Lazy load de componentes
import { LazyConfetti, LazyRippleEffect } from '@/lib/animations';

<Suspense fallback={<div>Loading...</div>}>
  <LazyConfetti />
</Suspense>

// Cleanup de animaciones
import { cleanupAnimations } from '@/lib/animations';

useEffect(() => {
  return () => {
    cleanupAnimations(elementRef.current);
  };
}, []);

// Obtener configuración optimizada
import { getOptimizedAnimationConfig } from '@/lib/animations';

const config = getOptimizedAnimationConfig();
// {
//   enableComplexAnimations: boolean,
//   maxSimultaneousAnimations: number,
//   defaultDuration: number,
//   enableParticles: boolean,
//   enableTransitions: boolean
// }
```

**Configuración Global de GSAP:**

El módulo configura automáticamente GSAP para mejor rendimiento:
- `force3D: true` - Acelerar con GPU
- `autoSleep: 60` - Reducir CPU cuando no hay animaciones
- `nullTargetWarn` - Solo en desarrollo

---

### 3. Mobile Detector (`utils/mobileDetector.ts`)

**Funcionalidades:**
- Detección de tipo de dispositivo (móvil, tablet, desktop)
- Detección de capacidades de hardware (CPU, RAM)
- Detección de velocidad de conexión
- Configuraciones optimizadas por dispositivo

**API:**

```tsx
import {
  getDeviceCapabilities,
  getMobileOptimizedConfig,
  logDeviceInfo
} from '@/lib/animations';

// Obtener capacidades del dispositivo
const capabilities = getDeviceCapabilities();
// {
//   isMobile: boolean,
//   isTablet: boolean,
//   isDesktop: boolean,
//   isLowEnd: boolean,
//   isTouchDevice: boolean,
//   screenSize: 'small' | 'medium' | 'large',
//   hardwareConcurrency: number,
//   memoryGB?: number,
//   connectionSpeed: 'slow' | 'medium' | 'fast'
// }

// Obtener configuración optimizada para el dispositivo
const config = getMobileOptimizedConfig();
// {
//   enableComplexAnimations: boolean,
//   enableParticleEffects: boolean,
//   enableBlurEffects: boolean,
//   maxSimultaneousAnimations: number,
//   reducedDuration: boolean,
//   enablePageTransitions: boolean,
//   enableMicrointeractions: boolean,
//   useSimplifiedSkeletons: boolean
// }

// Log de información (automático en desarrollo)
logDeviceInfo(); // Muestra en consola todas las capacidades
```

**Configuraciones por Dispositivo:**

| Dispositivo | Complex Animations | Particle Effects | Max Simultaneous | Blur Effects |
|-------------|-------------------|------------------|------------------|--------------|
| Desktop Alta Gama | ✅ | ✅ | 15 | ✅ |
| Tablet | ✅ | ✅ | 8 | ❌ |
| Móvil Alta Gama | ❌ | ❌ | 5 | ❌ |
| Móvil Baja Gama | ❌ | ❌ | 2 | ❌ |

---

### 4. Performance Tracker (`utils/performanceTracker.ts`)

**Funcionalidades:**
- Tracking de ejecución de animaciones
- Estadísticas de uso y rendimiento
- Reportes de animaciones más usadas/lentas
- Exportación de datos para análisis

**API:**

```tsx
import { performanceTracker, createTrackedAnimation } from '@/lib/animations';

// Tracking manual
performanceTracker.trackStart('anim-1', 'bounce', 'hover');
// ... ejecutar animación ...
performanceTracker.trackComplete('anim-1');

// Tracking automático
const trackedAnimation = createTrackedAnimation(
  'bounce',
  async () => {
    await gsap.to(element, { y: -20, duration: 0.5 });
  },
  'hover'
);

await trackedAnimation();

// Obtener estadísticas
const stats = performanceTracker.getStats('bounce');
// {
//   animationName: 'bounce',
//   totalExecutions: 42,
//   avgDuration: 150, // ms
//   minDuration: 120,
//   maxDuration: 200,
//   successRate: 0.98,
//   lastExecuted: 1699999999999,
//   triggers: { hover: 30, click: 12 }
// }

// Generar reporte completo
performanceTracker.logReport();

// Disponible en window para debugging (solo dev)
window.__animationTracker.logReport();
```

**Ejemplo de Reporte:**

```
=== 📊 Animation Performance Report ===

Total Animations Executed: 156
Unique Animation Types: 8
Average Success Rate: 98.50%
Currently Active: 2

--- Top 10 Most Used Animations ---
1. bounce: 42 times (avg: 150.00ms)
2. pulse: 38 times (avg: 200.00ms)
3. hover-scale: 35 times (avg: 100.00ms)
...

--- Slowest Animations ---
1. tada: 450.00ms average (min: 400.00ms, max: 500.00ms)
2. flip: 350.00ms average (min: 300.00ms, max: 400.00ms)
...

--- Trigger Distribution ---
hover: 85 times
click: 45 times
loop: 20 times
mount: 6 times
```

---

### 5. Reduced Motion Hooks (`hooks/useReducedMotion.ts`)

**Funcionalidades:**
- Hook para detectar `prefers-reduced-motion`
- Adaptación automática de duraciones
- Configuración completa de animación
- WCAG 2.1 compliant

**API:**

```tsx
import {
  useReducedMotion,
  useAnimationDuration,
  useAnimationConfig,
  useApplyReducedMotionStyles
} from '@/lib/animations';

// Hook básico
const prefersReducedMotion = useReducedMotion();

if (prefersReducedMotion) {
  // No animar o usar animación simple
}

// Hook de duración adaptativa
const duration = useAnimationDuration(0.5, 0.1);
// 0.5s normal, 0.1s con prefers-reduced-motion

// Hook de configuración completa
const config = useAnimationConfig();
// {
//   enableComplex: boolean,
//   enableSimple: boolean,
//   enableTransitions: boolean,
//   duration: number // 0 o 1
// }

// Aplicar estilos CSS globales
useApplyReducedMotionStyles();
// Agrega clase 'reduce-motion' al body
```

**CSS Companion:**

```css
/* En tu CSS global */
.reduce-motion * {
  animation-duration: 0.01ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.01ms !important;
}
```

---

## ⚙️ Configuración de Next.js

El archivo `next.config.ts` ya está optimizado con:

### Tree-shaking de GSAP
```typescript
experimental: {
  optimizePackageImports: ['gsap', 'lucide-react'],
}
```

### Code Splitting
- **Chunk GSAP:** Código de GSAP separado (prioridad 20)
- **Chunk Animations:** Animaciones personalizadas (prioridad 15)
- **Chunk Animated Components:** Componentes animados (prioridad 15)
- **Chunk Vendor:** Otras librerías (prioridad 10)

### Caching
```typescript
headers: [
  {
    source: '/_next/static/:path*',
    value: 'public, max-age=31536000, immutable'
  }
]
```

---

## 🎯 Best Practices

### 1. **Lazy Load Pesado**
```tsx
// ✅ Bueno - Lazy load de componentes pesados
const LazyConfetti = lazy(() => import('@/components/microinteractions/ConfettiCelebration'));

<Suspense fallback={null}>
  {showConfetti && <LazyConfetti />}
</Suspense>

// ❌ Malo - Importar todo de una
import { ConfettiCelebration } from '@/components/microinteractions/ConfettiCelebration';
```

### 2. **Cleanup de Animaciones**
```tsx
// ✅ Bueno - Cleanup en useEffect
useEffect(() => {
  const tl = gsap.timeline();
  tl.to(element, { x: 100 });

  return () => {
    tl.kill();
    cleanupAnimations(element);
  };
}, []);

// ❌ Malo - Sin cleanup
useEffect(() => {
  gsap.to(element, { x: 100 });
}, []);
```

### 3. **Respetar Prefers-Reduced-Motion**
```tsx
// ✅ Bueno - Adaptativo
const prefersReducedMotion = useReducedMotion();

<AnimatedIcon
  animation="bounce"
  trigger={prefersReducedMotion ? 'none' : 'hover'}
>

// ❌ Malo - Ignorar preferencia
<AnimatedIcon animation="bounce" trigger="hover">
```

### 4. **Tracking de Performance**
```tsx
// ✅ Bueno - Trackear animaciones críticas
useAnimationTracking('critical-animation', true);

// Revisar regularmente en desarrollo
window.__animationTracker.logReport();
```

### 5. **Configuración por Dispositivo**
```tsx
// ✅ Bueno - Adaptar a capacidades
const config = getMobileOptimizedConfig();

if (config.enableParticleEffects) {
  <LazyConfetti />
}

// ❌ Malo - Mismo código para todos
<ConfettiCelebration /> // Puede ser pesado en móvil
```

---

## 🐛 Debugging

### Performance Monitor Overlay

En desarrollo, el overlay aparece automáticamente. Para deshabilitarlo:

```tsx
<PerformanceMonitorProvider enableInProduction={false}>
```

### Animation Tracker

Accede al tracker en la consola del navegador:

```javascript
// Ver reporte completo
window.__animationTracker.logReport()

// Ver estadísticas específicas
window.__animationTracker.getStats('bounce')

// Ver animaciones activas
window.__animationTracker.getActiveAnimations()

// Ver top 10 más usadas
window.__animationTracker.getTopAnimations(10)

// Ver las más lentas
window.__animationTracker.getSlowestAnimations(5)

// Exportar datos
const data = window.__animationTracker.exportData()
console.log(JSON.stringify(data, null, 2))
```

### Device Info

Ver información del dispositivo:

```javascript
import { logDeviceInfo } from '@/lib/animations';

logDeviceInfo(); // En consola
```

---

## 📊 Métricas de Éxito

### Performance Targets

| Métrica | Target Desktop | Target Móvil |
|---------|---------------|--------------|
| FPS promedio | ≥ 60 | ≥ 30 |
| Bundle size (animaciones) | < 50kb gzipped | < 30kb gzipped |
| Animaciones simultáneas | < 10 | < 5 |
| Tiempo de carga inicial | < 1s | < 2s |

### Accesibilidad

- ✅ 100% compatible con `prefers-reduced-motion`
- ✅ WCAG 2.1 Level AA compliant
- ✅ Sin flash/parpadeo que pueda causar convulsiones
- ✅ Todas las animaciones pueden deshabilitarse

---

## 🔜 Próximas Fases

- **Fase 3.1:** Animaciones Contextuales Avanzadas
- **Fase 3.2:** Secuencias y Orquestación (GSAP Timelines)
- **Fase 3.3:** Micro-interacciones Premium (Ripple, Confetti, Skeleton)
- **Fase 3.4:** Page Transitions

---

## 📝 Changelog

### Fase 3.5 - Performance & Optimization (Completada)
- ✅ Sistema de lazy loading de GSAP plugins
- ✅ Performance Monitor con overlay visual
- ✅ Mobile detector con configuraciones adaptativas
- ✅ Performance tracker con analytics
- ✅ Hooks de accesibilidad (useReducedMotion)
- ✅ Optimización de bundle en next.config.ts
- ✅ Exports centralizados en index.ts

---

**Última actualización:** 2025-11-10
**Versión:** 3.5.0
