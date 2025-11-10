/**
 * useReducedMotion Hook
 *
 * Hook de React para respetar la preferencia de reducción de movimiento del usuario
 * Implementa WCAG 2.1 - Success Criterion 2.3.3 (Animation from Interactions)
 */

'use client';

import { useEffect, useState } from 'react';

/**
 * Hook para detectar si el usuario prefiere movimiento reducido
 *
 * @returns boolean - true si el usuario prefiere movimiento reducido
 *
 * @example
 * ```tsx
 * const prefersReducedMotion = useReducedMotion();
 *
 * <AnimatedIcon
 *   animation="bounce"
 *   trigger={prefersReducedMotion ? 'none' : 'hover'}
 * >
 *   <Icon />
 * </AnimatedIcon>
 * ```
 */
export const useReducedMotion = (): boolean => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    // Media query para detectar preferencia de movimiento reducido
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    // Setear valor inicial
    setPrefersReducedMotion(mediaQuery.matches);

    // Listener para cambios en la preferencia
    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    // Agregar listener (compatible con navegadores modernos y antiguos)
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else {
      // Fallback para navegadores antiguos
      mediaQuery.addListener(handleChange);
    }

    // Cleanup
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  return prefersReducedMotion;
};

/**
 * Hook para obtener configuración de animación adaptada a prefers-reduced-motion
 *
 * @param normalDuration - Duración normal de la animación
 * @param reducedDuration - Duración reducida (por defecto 0)
 * @returns Duración ajustada según la preferencia del usuario
 *
 * @example
 * ```tsx
 * const duration = useAnimationDuration(0.5, 0.1);
 * gsap.to(element, { x: 100, duration });
 * ```
 */
export const useAnimationDuration = (
  normalDuration: number,
  reducedDuration: number = 0
): number => {
  const prefersReducedMotion = useReducedMotion();
  return prefersReducedMotion ? reducedDuration : normalDuration;
};

/**
 * Hook para obtener configuración completa de animación
 *
 * @returns Configuración de animación con flags de habilitación
 *
 * @example
 * ```tsx
 * const config = useAnimationConfig();
 *
 * if (config.enableComplex) {
 *   // Ejecutar animación compleja
 * } else if (config.enableSimple) {
 *   // Ejecutar animación simple
 * }
 * ```
 */
export interface AnimationConfig {
  enableComplex: boolean; // Animaciones complejas (timelines, sequences)
  enableSimple: boolean;  // Animaciones simples (hover, fade)
  enableTransitions: boolean; // Transiciones CSS
  duration: number; // Multiplicador de duración (0 = sin animación, 1 = normal)
}

export const useAnimationConfig = (): AnimationConfig => {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return {
      enableComplex: false,
      enableSimple: false,
      enableTransitions: true, // Mantener transiciones instantáneas
      duration: 0,
    };
  }

  return {
    enableComplex: true,
    enableSimple: true,
    enableTransitions: true,
    duration: 1,
  };
};

/**
 * Aplica estilos CSS para respetar prefers-reduced-motion
 */
export const useApplyReducedMotionStyles = () => {
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion) {
      // Agregar clase global al body
      document.body.classList.add('reduce-motion');
    } else {
      document.body.classList.remove('reduce-motion');
    }
  }, [prefersReducedMotion]);
};
