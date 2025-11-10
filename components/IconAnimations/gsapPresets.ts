/**
 * Presets de Animaciones GSAP para Iconos
 * Configuraciones reutilizables para el componente AnimatedIcon
 */

import { gsap } from 'gsap';

export type AnimationPreset =
  | 'bounce'
  | 'spin'
  | 'shake'
  | 'pulse'
  | 'glow'
  | 'float'
  | 'swing'
  | 'wiggle'
  | 'heartbeat'
  | 'tada'
  | 'flip'
  | 'rubberBand';

export type TriggerType = 'hover' | 'click' | 'mount' | 'loop' | 'none';

export interface AnimationConfig {
  duration: number;
  ease: string;
  repeat?: number;
  yoyo?: boolean;
  delay?: number;
  paused?: boolean;
}

/**
 * Configuraciones de animación por preset
 */
export const presetConfigs: Record<AnimationPreset, AnimationConfig> = {
  bounce: {
    duration: 0.6,
    ease: 'elastic.out(1, 0.3)',
  },
  spin: {
    duration: 0.8,
    ease: 'power2.inOut',
  },
  shake: {
    duration: 0.5,
    ease: 'power2.inOut',
  },
  pulse: {
    duration: 0.6,
    ease: 'power1.inOut',
    repeat: -1,
    yoyo: true,
  },
  glow: {
    duration: 1,
    ease: 'power1.inOut',
    repeat: -1,
    yoyo: true,
  },
  float: {
    duration: 2,
    ease: 'sine.inOut',
    repeat: -1,
    yoyo: true,
  },
  swing: {
    duration: 0.8,
    ease: 'elastic.out(1.5, 0.5)',
  },
  wiggle: {
    duration: 0.4,
    ease: 'power1.inOut',
  },
  heartbeat: {
    duration: 0.3,
    ease: 'power2.out',
  },
  tada: {
    duration: 1,
    ease: 'power2.out',
  },
  flip: {
    duration: 0.6,
    ease: 'back.out(1.7)',
  },
  rubberBand: {
    duration: 0.8,
    ease: 'elastic.out(1, 0.3)',
  },
};

/**
 * Funciones de animación GSAP para cada preset
 */
export const animationFunctions: Record<AnimationPreset, (element: HTMLElement) => gsap.core.Tween | gsap.core.Timeline> = {
  // Bounce suave
  bounce: (element) => {
    return gsap.to(element, {
      ...presetConfigs.bounce,
      scale: 1.2,
      yoyo: true,
      repeat: 1,
    });
  },

  // Rotación 360°
  spin: (element) => {
    return gsap.to(element, {
      ...presetConfigs.spin,
      rotation: 360,
    });
  },

  // Sacudida horizontal
  shake: (element) => {
    const tl = gsap.timeline();
    tl.to(element, { x: -10, duration: 0.1 })
      .to(element, { x: 10, duration: 0.1 })
      .to(element, { x: -10, duration: 0.1 })
      .to(element, { x: 10, duration: 0.1 })
      .to(element, { x: 0, duration: 0.1 });
    return tl;
  },

  // Pulso de escala
  pulse: (element) => {
    return gsap.to(element, {
      ...presetConfigs.pulse,
      scale: 1.1,
    });
  },

  // Glow con drop-shadow
  glow: (element) => {
    const tl = gsap.timeline({ repeat: -1, yoyo: true });
    tl.to(element, {
      ...presetConfigs.glow,
      filter: 'drop-shadow(0 0 10px currentColor)',
    });
    return tl;
  },

  // Flotación vertical
  float: (element) => {
    return gsap.to(element, {
      ...presetConfigs.float,
      y: -10,
    });
  },

  // Balanceo
  swing: (element) => {
    return gsap.to(element, {
      ...presetConfigs.swing,
      rotation: 15,
      yoyo: true,
      repeat: 1,
      transformOrigin: 'top center',
    });
  },

  // Wiggle (rotación rápida)
  wiggle: (element) => {
    const tl = gsap.timeline();
    const duration = presetConfigs.wiggle.duration / 5; // Dividir en 5 pasos
    tl.to(element, { rotation: -15, duration })
      .to(element, { rotation: 15, duration })
      .to(element, { rotation: -15, duration })
      .to(element, { rotation: 15, duration })
      .to(element, { rotation: 0, duration });
    return tl;
  },

  // Heartbeat (dos pulsos)
  heartbeat: (element) => {
    const tl = gsap.timeline();
    tl.to(element, { scale: 1.3, duration: 0.15, ease: 'power2.out' })
      .to(element, { scale: 1, duration: 0.15 })
      .to(element, { scale: 1.2, duration: 0.15 })
      .to(element, { scale: 1, duration: 0.15 });
    return tl;
  },

  // Tada (escala con rotación)
  tada: (element) => {
    const tl = gsap.timeline();
    tl.to(element, {
      scale: 0.9,
      rotation: -3,
      duration: 0.1,
    })
      .to(element, {
        scale: 1.1,
        rotation: 3,
        duration: 0.1,
      })
      .to(element, {
        scale: 1.1,
        rotation: -3,
        duration: 0.1,
        repeat: 2,
        yoyo: true,
      })
      .to(element, {
        scale: 1,
        rotation: 0,
        duration: 0.2,
      });
    return tl;
  },

  // Flip horizontal
  flip: (element) => {
    return gsap.to(element, {
      ...presetConfigs.flip,
      rotationY: 360,
    });
  },

  // Rubber band (estiramiento elástico)
  rubberBand: (element) => {
    const tl = gsap.timeline();
    tl.to(element, { scaleX: 1.25, scaleY: 0.75, duration: 0.2 })
      .to(element, { scaleX: 0.75, scaleY: 1.25, duration: 0.2 })
      .to(element, { scaleX: 1.15, scaleY: 0.85, duration: 0.2 })
      .to(element, { scaleX: 1, scaleY: 1, duration: 0.2, ease: 'elastic.out(1, 0.3)' });
    return tl;
  },
};

/**
 * Función helper para obtener la animación según trigger y preset
 */
export const getAnimation = (
  element: HTMLElement,
  preset: AnimationPreset,
  trigger: TriggerType = 'none'
): gsap.core.Tween | gsap.core.Timeline | null => {
  if (!element) return null;

  const animationFn = animationFunctions[preset];
  if (!animationFn) {
    console.warn(`Animation preset "${preset}" not found`);
    return null;
  }

  const animation = animationFn(element);

  // Si es loop, la animación ya tiene repeat: -1
  if (trigger === 'loop') {
    animation.play();
  } else if (trigger === 'mount') {
    animation.play();
  } else {
    // Para hover y click, pausar hasta que se active
    animation.pause();
  }

  return animation;
};
