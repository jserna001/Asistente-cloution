/**
 * useSequence Hook
 *
 * Hook para usar secuencias GSAP de forma declarativa en componentes React
 */

'use client';

import { useRef, useEffect, useCallback } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { getSequence, type SequencePresetName, type SequenceConfig } from '../orchestration/sequencePresets';
import { performanceTracker } from '../utils/performanceTracker';
import { useReducedMotion } from './useReducedMotion';

gsap.registerPlugin(useGSAP);

export interface UseSequenceOptions extends SequenceConfig {
  autoplay?: boolean;
  dependencies?: any[];
  respectReducedMotion?: boolean;
  trackPerformance?: boolean;
}

export interface UseSequenceReturn {
  play: () => void;
  pause: () => void;
  reverse: () => void;
  restart: () => void;
  seek: (time: number) => void;
  kill: () => void;
  isActive: () => boolean;
  progress: (value?: number) => number | void;
  timeScale: (value?: number) => number | void;
}

/**
 * Hook para usar secuencias GSAP
 *
 * @param sequenceName - Nombre de la secuencia preset
 * @param elementOrElements - Elemento(s) a animar
 * @param options - Opciones de configuración
 *
 * @example
 * ```tsx
 * const messageRef = useRef<HTMLDivElement>(null);
 * const { play } = useSequence('messageEntry', messageRef, { autoplay: true });
 *
 * return <div ref={messageRef}>Message</div>;
 * ```
 */
export const useSequence = (
  sequenceName: SequencePresetName,
  elementOrElements: React.RefObject<HTMLElement | null> | React.RefObject<HTMLElement[] | null>,
  options: UseSequenceOptions = {}
): UseSequenceReturn => {
  const {
    autoplay = false,
    dependencies = [],
    respectReducedMotion = true,
    trackPerformance = true,
    ...sequenceConfig
  } = options;

  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const trackingIdRef = useRef<string | null>(null);
  const prefersReducedMotion = useReducedMotion();

  // Crear la secuencia
  useGSAP(() => {
    // Si está habilitado reduced motion, no animar
    if (respectReducedMotion && prefersReducedMotion) {
      return;
    }

    // Obtener elemento(s)
    const element = 'current' in elementOrElements ? elementOrElements.current : null;
    if (!element) return;

    // Crear tracking ID
    if (trackPerformance) {
      trackingIdRef.current = `sequence-${sequenceName}-${Date.now()}`;
      performanceTracker.trackStart(
        trackingIdRef.current,
        sequenceName,
        autoplay ? 'autoplay' : 'manual'
      );
    }

    // Obtener la función de secuencia
    const sequenceFn = getSequence(sequenceName);

    // Crear timeline
    const timeline = sequenceFn(element, {
      ...sequenceConfig,
      onComplete: () => {
        if (trackPerformance && trackingIdRef.current) {
          performanceTracker.trackComplete(trackingIdRef.current);
        }
        sequenceConfig.onComplete?.();
      },
    });

    timelineRef.current = timeline;

    // Autoplay
    if (autoplay) {
      timeline.play();
    } else {
      timeline.pause();
    }

    // Cleanup
    return () => {
      if (timeline) {
        timeline.kill();
      }
    };
  }, {
    dependencies: [sequenceName, autoplay, prefersReducedMotion, ...dependencies],
    scope: elementOrElements as any,
  });

  // Control methods
  const play = useCallback(() => {
    if (timelineRef.current) {
      timelineRef.current.play();
    }
  }, []);

  const pause = useCallback(() => {
    if (timelineRef.current) {
      timelineRef.current.pause();
    }
  }, []);

  const reverse = useCallback(() => {
    if (timelineRef.current) {
      timelineRef.current.reverse();
    }
  }, []);

  const restart = useCallback(() => {
    if (timelineRef.current) {
      timelineRef.current.restart();
    }
  }, []);

  const seek = useCallback((time: number) => {
    if (timelineRef.current) {
      timelineRef.current.seek(time);
    }
  }, []);

  const kill = useCallback(() => {
    if (timelineRef.current) {
      timelineRef.current.kill();
      timelineRef.current = null;
    }
  }, []);

  const isActive = useCallback(() => {
    return timelineRef.current?.isActive() ?? false;
  }, []);

  const progress = useCallback((value?: number) => {
    if (!timelineRef.current) return 0;
    if (value !== undefined) {
      timelineRef.current.progress(value);
      return;
    }
    return timelineRef.current.progress();
  }, []);

  const timeScale = useCallback((value?: number) => {
    if (!timelineRef.current) return 1;
    if (value !== undefined) {
      timelineRef.current.timeScale(value);
      return;
    }
    return timelineRef.current.timeScale();
  }, []);

  return {
    play,
    pause,
    reverse,
    restart,
    seek,
    kill,
    isActive,
    progress,
    timeScale,
  };
};

/**
 * Hook simplificado para secuencias de un solo uso (fire and forget)
 *
 * @example
 * ```tsx
 * const buttonRef = useRef<HTMLButtonElement>(null);
 * const playAnimation = useSequenceOnce('taskComplete', buttonRef);
 *
 * return (
 *   <button ref={buttonRef} onClick={playAnimation}>
 *     Complete Task
 *   </button>
 * );
 * ```
 */
export const useSequenceOnce = (
  sequenceName: SequencePresetName,
  elementRef: React.RefObject<HTMLElement | null>,
  options?: Omit<UseSequenceOptions, 'autoplay'>
): (() => void) => {
  const { play } = useSequence(sequenceName, elementRef, {
    ...options,
    autoplay: false,
  });

  return play;
};

/**
 * Hook para stagger animations (múltiples elementos)
 *
 * @example
 * ```tsx
 * const itemsRef = useRef<HTMLElement[]>([]);
 * useStaggerSequence('staggerFadeIn', itemsRef, { autoplay: true });
 *
 * return items.map((item, i) => (
 *   <div ref={el => { if (el) itemsRef.current[i] = el; }}>
 *     {item}
 *   </div>
 * ));
 * ```
 */
export const useStaggerSequence = (
  sequenceName: 'staggerFadeIn' | 'staggerSlideIn' | 'typingIndicator',
  elementsRef: React.RefObject<HTMLElement[] | null>,
  options?: UseSequenceOptions
): UseSequenceReturn => {
  return useSequence(sequenceName, elementsRef as any, options);
};
