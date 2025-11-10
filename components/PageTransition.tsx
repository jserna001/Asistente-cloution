/**
 * PageTransition Component
 *
 * Wrapper para páginas con transiciones automáticas
 */

'use client';

import React, { useRef, useEffect, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { animatePageEnter, getRouteTransition, type TransitionType } from '@/lib/animations/orchestration/pageTransitions';
import { useReducedMotion } from '@/lib/animations';

interface PageTransitionProps {
  children: ReactNode;
  type?: TransitionType;
  duration?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const PageTransition: React.FC<PageTransitionProps> = ({
  children,
  type,
  duration = 0.4,
  className = '',
  style = {},
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();

  // Determinar tipo de transición
  const transitionType = type || getRouteTransition(pathname);

  useEffect(() => {
    if (!containerRef.current || prefersReducedMotion) return;

    // Animar entrada
    const timeline = animatePageEnter(containerRef.current, transitionType, {
      duration,
      ease: 'power2.out',
    });

    return () => {
      timeline.kill();
    };
  }, [pathname, transitionType, duration, prefersReducedMotion]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        width: '100%',
        height: '100%',
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/**
 * Hook para usar transiciones programáticamente
 */
export const usePageTransition = () => {
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();

  const transitionTo = (
    element: HTMLElement,
    type?: TransitionType,
    duration: number = 0.3
  ) => {
    if (prefersReducedMotion) return Promise.resolve();

    const transitionType = type || getRouteTransition(pathname);
    return animatePageEnter(element, transitionType, { duration });
  };

  return {
    transitionTo,
    currentPath: pathname,
  };
};
