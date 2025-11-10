/**
 * Sequence Presets
 *
 * GSAP Timelines complejas para secuencias de animación coordinadas
 */

import { gsap } from 'gsap';

export type SequencePresetName =
  | 'typingIndicator'
  | 'messageEntry'
  | 'messageExit'
  | 'taskComplete'
  | 'errorShake'
  | 'staggerFadeIn'
  | 'staggerSlideIn'
  | 'logoReveal'
  | 'cardFlip'
  | 'confettiBurst';

export interface SequenceConfig {
  repeat?: number;
  yoyo?: boolean;
  repeatDelay?: number;
  onComplete?: () => void;
  onStart?: () => void;
  onUpdate?: (progress: number) => void;
}

/**
 * Enhanced Typing Indicator
 * 3 dots con animación ondulante
 */
export const typingIndicator = (
  elements: HTMLElement[],
  config?: SequenceConfig
): gsap.core.Timeline => {
  const tl = gsap.timeline({
    repeat: config?.repeat ?? -1,
    repeatDelay: config?.repeatDelay ?? 0,
    onComplete: config?.onComplete,
    onStart: config?.onStart,
  });

  elements.forEach((el, i) => {
    tl.to(
      el,
      {
        y: -10,
        duration: 0.4,
        ease: 'power1.inOut',
        yoyo: true,
        repeat: 1,
      },
      i * 0.15
    );
  });

  return tl;
};

/**
 * Message Entry Sequence
 * Entrada suave de mensaje con avatar + contenido
 */
export const messageEntry = (
  container: HTMLElement,
  config?: SequenceConfig
): gsap.core.Timeline => {
  const tl = gsap.timeline({
    onComplete: config?.onComplete,
    onStart: config?.onStart,
  });

  const avatar = container.querySelector('.message-avatar') as HTMLElement;
  const content = container.querySelector('.message-content') as HTMLElement;
  const metadata = container.querySelector('.message-metadata') as HTMLElement;

  // Fade in del contenedor
  tl.from(container, {
    opacity: 0,
    y: 20,
    duration: 0.3,
    ease: 'power2.out',
  });

  // Avatar scale in (si existe)
  if (avatar) {
    tl.from(
      avatar,
      {
        scale: 0,
        rotation: -180,
        duration: 0.4,
        ease: 'back.out(1.7)',
      },
      '-=0.2'
    );
  }

  // Contenido slide in
  if (content) {
    tl.from(
      content,
      {
        opacity: 0,
        x: -20,
        duration: 0.4,
        ease: 'power2.out',
      },
      '-=0.3'
    );
  }

  // Metadata fade in (si existe)
  if (metadata) {
    tl.from(
      metadata,
      {
        opacity: 0,
        duration: 0.2,
      },
      '-=0.1'
    );
  }

  return tl;
};

/**
 * Message Exit Sequence
 * Salida suave de mensaje
 */
export const messageExit = (
  container: HTMLElement,
  config?: SequenceConfig
): gsap.core.Timeline => {
  const tl = gsap.timeline({
    onComplete: config?.onComplete,
  });

  tl.to(container, {
    opacity: 0,
    x: -50,
    duration: 0.3,
    ease: 'power2.in',
  });

  return tl;
};

/**
 * Task Completion Celebration
 * Secuencia de celebración para tareas completadas
 */
export const taskComplete = (
  element: HTMLElement,
  config?: SequenceConfig
): gsap.core.Timeline => {
  const tl = gsap.timeline({
    onComplete: config?.onComplete,
  });

  // Escala elástica
  tl.to(element, {
    scale: 1.3,
    duration: 0.2,
    ease: 'power2.in',
  })
    .to(element, {
      scale: 1,
      duration: 0.5,
      ease: 'elastic.out(1, 0.5)',
    })
    // Rotación sutil
    .to(
      element,
      {
        rotation: 360,
        duration: 0.6,
        ease: 'power2.inOut',
      },
      '-=0.5'
    )
    // Glow effect
    .to(
      element,
      {
        filter: 'drop-shadow(0 0 20px rgba(16, 185, 129, 0.8))',
        duration: 0.3,
      },
      '-=0.4'
    )
    .to(element, {
      filter: 'drop-shadow(0 0 0px rgba(16, 185, 129, 0))',
      duration: 0.3,
    });

  return tl;
};

/**
 * Error Shake
 * Shake más sofisticado para errores
 */
export const errorShake = (
  element: HTMLElement,
  config?: SequenceConfig
): gsap.core.Timeline => {
  const tl = gsap.timeline({
    onComplete: config?.onComplete,
  });

  // Shake horizontal con decay
  tl.to(element, { x: -15, duration: 0.08 })
    .to(element, { x: 15, duration: 0.08 })
    .to(element, { x: -10, duration: 0.08 })
    .to(element, { x: 10, duration: 0.08 })
    .to(element, { x: -5, duration: 0.08 })
    .to(element, { x: 5, duration: 0.08 })
    .to(element, { x: 0, duration: 0.08 })
    // Flash rojo
    .to(
      element,
      {
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        duration: 0.1,
        yoyo: true,
        repeat: 1,
      },
      0
    );

  return tl;
};

/**
 * Stagger Fade In
 * Fade in escalonado para listas
 */
export const staggerFadeIn = (
  elements: HTMLElement[],
  config?: SequenceConfig
): gsap.core.Timeline => {
  const tl = gsap.timeline({
    onComplete: config?.onComplete,
  });

  tl.from(elements, {
    opacity: 0,
    y: 20,
    duration: 0.4,
    stagger: 0.1,
    ease: 'power2.out',
  });

  return tl;
};

/**
 * Stagger Slide In
 * Slide in escalonado desde la derecha
 */
export const staggerSlideIn = (
  elements: HTMLElement[],
  config?: SequenceConfig
): gsap.core.Timeline => {
  const tl = gsap.timeline({
    onComplete: config?.onComplete,
  });

  tl.from(elements, {
    opacity: 0,
    x: 100,
    duration: 0.5,
    stagger: 0.08,
    ease: 'back.out(1.2)',
  });

  return tl;
};

/**
 * Logo Reveal
 * Revelación dramática del logo
 */
export const logoReveal = (
  element: HTMLElement,
  config?: SequenceConfig
): gsap.core.Timeline => {
  const tl = gsap.timeline({
    onComplete: config?.onComplete,
  });

  // Escala desde 0
  tl.from(element, {
    scale: 0,
    rotation: -540,
    duration: 1,
    ease: 'back.out(1.7)',
  })
    // Pulso
    .to(element, {
      scale: 1.1,
      duration: 0.2,
      yoyo: true,
      repeat: 1,
    })
    // Glow
    .to(
      element,
      {
        filter: 'drop-shadow(0 0 30px rgba(59, 130, 246, 0.8))',
        duration: 0.5,
      },
      '-=0.4'
    )
    .to(element, {
      filter: 'drop-shadow(0 0 10px rgba(59, 130, 246, 0.3))',
      duration: 0.3,
    });

  return tl;
};

/**
 * Card Flip (original function for direct use)
 * Flip 3D de tarjeta con contenido
 */
export const cardFlipDirect = (
  front: HTMLElement,
  back: HTMLElement,
  config?: SequenceConfig
): gsap.core.Timeline => {
  const tl = gsap.timeline({
    onComplete: config?.onComplete,
  });

  const container = front.parentElement as HTMLElement;

  // Configurar perspectiva
  gsap.set(container, { perspective: 1000 });
  gsap.set([front, back], {
    backfaceVisibility: 'hidden',
    transformStyle: 'preserve-3d',
  });
  gsap.set(back, { rotationY: 180 });

  // Flip animation
  tl.to(front, {
    rotationY: -180,
    duration: 0.6,
    ease: 'power2.inOut',
  }).to(
    back,
    {
      rotationY: 0,
      duration: 0.6,
      ease: 'power2.inOut',
    },
    0
  );

  return tl;
};

/**
 * Card Flip (wrapper for use with standard signature)
 * Expects element to be a container with two children (front and back)
 */
export const cardFlip = (
  element: HTMLElement,
  config?: SequenceConfig
): gsap.core.Timeline => {
  const children = element.children;
  if (children.length < 2) {
    console.warn('cardFlip: element must have at least 2 children (front and back)');
    return gsap.timeline();
  }

  const front = children[0] as HTMLElement;
  const back = children[1] as HTMLElement;

  return cardFlipDirect(front, back, config);
};

/**
 * Confetti Burst
 * Preparación para burst de confetti
 */
export const confettiBurst = (
  element: HTMLElement,
  config?: SequenceConfig
): gsap.core.Timeline => {
  const tl = gsap.timeline({
    onComplete: config?.onComplete,
  });

  // Escala inicial
  tl.to(element, {
    scale: 1.5,
    duration: 0.2,
  })
    // Explosión
    .to(element, {
      scale: 1,
      duration: 0.3,
      ease: 'elastic.out(1, 0.3)',
    })
    // Callback para disparar confetti real (si está disponible)
    .call(() => {
      if (config?.onComplete) {
        config.onComplete();
      }
    });

  return tl;
};

// Mapa de presets
export const SEQUENCE_PRESETS: Record<
  SequencePresetName,
  (element: any, config?: SequenceConfig) => gsap.core.Timeline
> = {
  typingIndicator,
  messageEntry,
  messageExit,
  taskComplete,
  errorShake,
  staggerFadeIn,
  staggerSlideIn,
  logoReveal,
  cardFlip,
  confettiBurst,
};

/**
 * Obtiene una secuencia por nombre
 */
export const getSequence = (
  name: SequencePresetName
): ((element: any, config?: SequenceConfig) => gsap.core.Timeline) => {
  return SEQUENCE_PRESETS[name];
};
