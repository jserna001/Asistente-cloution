/**
 * Page Transitions
 *
 * Sistema de transiciones entre páginas usando GSAP
 */

import { gsap } from 'gsap';

export type TransitionType = 'fade' | 'slide' | 'scale' | 'slideUp' | 'slideDown' | 'none';

export interface TransitionConfig {
  duration?: number;
  ease?: string;
  delay?: number;
  onComplete?: () => void;
  onStart?: () => void;
}

/**
 * Fade Transition
 * Entrada/salida suave con opacity
 */
export const fadeTransition = {
  initial: {
    opacity: 0,
  },
  animate: {
    opacity: 1,
  },
  exit: {
    opacity: 0,
  },
};

/**
 * Slide Transition (horizontal)
 * Deslizamiento desde la derecha
 */
export const slideTransition = {
  initial: {
    opacity: 0,
    x: 300,
  },
  animate: {
    opacity: 1,
    x: 0,
  },
  exit: {
    opacity: 0,
    x: -300,
  },
};

/**
 * Slide Up Transition
 * Deslizamiento desde abajo
 */
export const slideUpTransition = {
  initial: {
    opacity: 0,
    y: 100,
  },
  animate: {
    opacity: 1,
    y: 0,
  },
  exit: {
    opacity: 0,
    y: -100,
  },
};

/**
 * Slide Down Transition
 * Deslizamiento desde arriba
 */
export const slideDownTransition = {
  initial: {
    opacity: 0,
    y: -100,
  },
  animate: {
    opacity: 1,
    y: 0,
  },
  exit: {
    opacity: 0,
    y: 100,
  },
};

/**
 * Scale Transition
 * Escala con efecto zoom
 */
export const scaleTransition = {
  initial: {
    opacity: 0,
    scale: 0.8,
  },
  animate: {
    opacity: 1,
    scale: 1,
  },
  exit: {
    opacity: 0,
    scale: 0.8,
  },
};

/**
 * None Transition
 * Sin transición
 */
export const noneTransition = {
  initial: {},
  animate: {},
  exit: {},
};

// Mapa de transiciones
export const TRANSITION_PRESETS = {
  fade: fadeTransition,
  slide: slideTransition,
  slideUp: slideUpTransition,
  slideDown: slideDownTransition,
  scale: scaleTransition,
  none: noneTransition,
};

/**
 * Obtiene una transición por nombre
 */
export const getTransition = (type: TransitionType) => {
  return TRANSITION_PRESETS[type];
};

/**
 * Anima la entrada de un elemento usando GSAP
 */
export const animatePageEnter = (
  element: HTMLElement,
  type: TransitionType = 'fade',
  config: TransitionConfig = {}
): gsap.core.Timeline => {
  const {
    duration = 0.3,
    ease = 'power2.out',
    delay = 0,
    onComplete,
    onStart,
  } = config;

  const transition = getTransition(type);
  const tl = gsap.timeline({
    onComplete,
    onStart,
  });

  tl.from(element, {
    ...transition.initial,
    duration,
    ease,
    delay,
  });

  return tl;
};

/**
 * Anima la salida de un elemento usando GSAP
 */
export const animatePageExit = (
  element: HTMLElement,
  type: TransitionType = 'fade',
  config: TransitionConfig = {}
): gsap.core.Timeline => {
  const {
    duration = 0.3,
    ease = 'power2.in',
    delay = 0,
    onComplete,
    onStart,
  } = config;

  const transition = getTransition(type);
  const tl = gsap.timeline({
    onComplete,
    onStart,
  });

  tl.to(element, {
    ...transition.exit,
    duration,
    ease,
    delay,
  });

  return tl;
};

/**
 * Transición completa: salida + entrada
 */
export const transitionBetweenPages = async (
  exitElement: HTMLElement | null,
  enterElement: HTMLElement,
  type: TransitionType = 'fade',
  config: TransitionConfig = {}
): Promise<void> => {
  const { duration = 0.3 } = config;

  // Si hay elemento de salida, animarlo
  if (exitElement) {
    await animatePageExit(exitElement, type, {
      ...config,
      duration: duration * 0.8, // Salida más rápida
    });
  }

  // Animar entrada
  await animatePageEnter(enterElement, type, config);
};

/**
 * Configuraciones específicas por ruta
 */
export const ROUTE_TRANSITIONS: Record<string, TransitionType> = {
  '/': 'fade',
  '/login': 'slideUp',
  '/settings': 'slide',
  '/onboarding': 'slide',
};

/**
 * Obtiene el tipo de transición para una ruta
 */
export const getRouteTransition = (pathname: string): TransitionType => {
  return ROUTE_TRANSITIONS[pathname] || 'fade';
};
