/**
 * Animation Optimizer
 *
 * Sistema de optimización para animaciones GSAP:
 * - Lazy loading de plugins
 * - Code splitting
 * - Gestión de recursos
 */

import { gsap } from 'gsap';
import { lazy } from 'react';

// Estado de plugins cargados
let pluginsLoaded = {
  scrollTrigger: false,
  motionPath: false,
  drawSVG: false,
};

/**
 * Lazy load de GSAP ScrollTrigger plugin
 * Usado para animaciones basadas en scroll
 */
export const loadScrollTrigger = async () => {
  if (pluginsLoaded.scrollTrigger) {
    return;
  }

  try {
    const { ScrollTrigger } = await import('gsap/ScrollTrigger');
    gsap.registerPlugin(ScrollTrigger);
    pluginsLoaded.scrollTrigger = true;
    console.log('[AnimationOptimizer] ScrollTrigger loaded');
  } catch (error) {
    console.error('[AnimationOptimizer] Error loading ScrollTrigger:', error);
  }
};

/**
 * Lazy load de GSAP MotionPath plugin
 * Usado para animaciones de trayectorias complejas
 */
export const loadMotionPath = async () => {
  if (pluginsLoaded.motionPath) {
    return;
  }

  try {
    const { MotionPathPlugin } = await import('gsap/MotionPathPlugin');
    gsap.registerPlugin(MotionPathPlugin);
    pluginsLoaded.motionPath = true;
    console.log('[AnimationOptimizer] MotionPath loaded');
  } catch (error) {
    console.error('[AnimationOptimizer] Error loading MotionPath:', error);
  }
};

/**
 * Lazy load de GSAP DrawSVG plugin
 * Usado para animaciones de dibujo de SVG
 * Nota: Este es un plugin premium de GSAP
 */
export const loadDrawSVG = async () => {
  if (pluginsLoaded.drawSVG) {
    return;
  }

  try {
    const { DrawSVGPlugin } = await import('gsap/DrawSVGPlugin');
    gsap.registerPlugin(DrawSVGPlugin);
    pluginsLoaded.drawSVG = true;
    console.log('[AnimationOptimizer] DrawSVG loaded');
  } catch (error) {
    console.error('[AnimationOptimizer] Error loading DrawSVG:', error);
  }
};

/**
 * Carga todos los plugins GSAP bajo demanda
 */
export const loadAllGSAPPlugins = async () => {
  await Promise.all([
    loadScrollTrigger(),
    loadMotionPath(),
    // loadDrawSVG(), // Comentado - requiere licencia premium
  ]);
};

/**
 * Lazy load de componentes pesados de animación
 */
export const LazyConfetti = lazy(() => import('@/components/microinteractions/ConfettiCelebration'));
export const LazyRippleEffect = lazy(() => import('@/components/microinteractions/RippleEffect'));
export const LazySkeletonLoader = lazy(() => import('@/components/microinteractions/SkeletonLoader'));

/**
 * Preload de componentes críticos
 * Útil para componentes que se mostrarán pronto
 */
export const preloadComponent = (component: () => Promise<any>) => {
  if (typeof window !== 'undefined') {
    // Precargar en idle time para no bloquear UI
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => component());
    } else {
      // Fallback para navegadores sin requestIdleCallback
      setTimeout(() => component(), 1);
    }
  }
};

/**
 * Limpia animaciones GSAP de elementos eliminados del DOM
 * Previene memory leaks
 */
export const cleanupAnimations = (element: HTMLElement | null) => {
  if (!element) return;

  // Matar todas las animaciones GSAP en el elemento
  gsap.killTweensOf(element);

  // Limpiar children recursivamente
  const children = element.querySelectorAll('*');
  children.forEach((child) => {
    gsap.killTweensOf(child);
  });
};

/**
 * Optimiza configuración de GSAP para mejor rendimiento
 */
export const optimizeGSAP = () => {
  // Configuración global de GSAP para mejor rendimiento
  gsap.config({
    // Forzar uso de GPU cuando sea posible
    force3D: true,
    // Reducir precisión para mejor performance
    autoSleep: 60,
    // Null target warnings solo en dev
    nullTargetWarn: process.env.NODE_ENV === 'development',
  });

  // Configurar defaults para mejor performance
  gsap.defaults({
    ease: 'power2.inOut',
    duration: 0.3,
    // Usar will-change para optimización
    force3D: true,
  });

  console.log('[AnimationOptimizer] GSAP optimized for performance');
};

/**
 * Verifica si las animaciones deben estar habilitadas
 * basado en preferencias del usuario y capacidad del dispositivo
 */
export const shouldEnableAnimations = (): boolean => {
  if (typeof window === 'undefined') return false;

  // Respetar prefers-reduced-motion
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) {
    return false;
  }

  // Verificar si el dispositivo tiene suficiente potencia
  // (esto se complementará con mobileDetector.ts)
  const isLowEndDevice = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2;
  if (isLowEndDevice) {
    console.log('[AnimationOptimizer] Low-end device detected, animations may be limited');
  }

  return true;
};

/**
 * Obtiene configuración de animación optimizada según el contexto
 */
export interface AnimationConfig {
  enableComplexAnimations: boolean;
  maxSimultaneousAnimations: number;
  defaultDuration: number;
  enableParticles: boolean;
  enableTransitions: boolean;
}

export const getOptimizedAnimationConfig = (): AnimationConfig => {
  const baseConfig: AnimationConfig = {
    enableComplexAnimations: true,
    maxSimultaneousAnimations: 10,
    defaultDuration: 0.3,
    enableParticles: true,
    enableTransitions: true,
  };

  if (!shouldEnableAnimations()) {
    return {
      enableComplexAnimations: false,
      maxSimultaneousAnimations: 0,
      defaultDuration: 0,
      enableParticles: false,
      enableTransitions: false,
    };
  }

  // Ajustar según hardware
  const isLowEndDevice = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
  if (isLowEndDevice) {
    return {
      enableComplexAnimations: false,
      maxSimultaneousAnimations: 3,
      defaultDuration: 0.2, // Más rápido en dispositivos lentos
      enableParticles: false,
      enableTransitions: true,
    };
  }

  return baseConfig;
};

// Inicializar optimizaciones al cargar el módulo
if (typeof window !== 'undefined') {
  optimizeGSAP();
}
