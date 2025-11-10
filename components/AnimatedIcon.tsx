'use client';

/**
 * AnimatedIcon - Wrapper para iconos con animaciones GSAP
 *
 * @example
 * <AnimatedIcon animation="bounce" trigger="hover">
 *   <SendIcon size={20} />
 * </AnimatedIcon>
 *
 * <AnimatedIcon animation="glow" trigger="loop">
 *   <BotIcon size={24} />
 * </AnimatedIcon>
 */

import React, { useRef, useEffect, useState } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import {
  AnimationPreset,
  TriggerType,
  getAnimation,
} from './IconAnimations/gsapPresets';

gsap.registerPlugin(useGSAP);

interface AnimatedIconProps {
  /** Tipo de animación a aplicar */
  animation: AnimationPreset;

  /** Cuándo activar la animación */
  trigger?: TriggerType;

  /** Elementos hijo (el icono) */
  children: React.ReactNode;

  /** Clases CSS adicionales */
  className?: string;

  /** Estilos inline adicionales */
  style?: React.CSSProperties;

  /** Callback cuando la animación termina */
  onComplete?: () => void;

  /** Deshabilitar la animación */
  disabled?: boolean;
}

export const AnimatedIcon: React.FC<AnimatedIconProps> = ({
  animation,
  trigger = 'hover',
  children,
  className = '',
  style = {},
  onComplete,
  disabled = false,
}) => {
  const iconRef = useRef<HTMLSpanElement>(null);
  const animationRef = useRef<gsap.core.Tween | gsap.core.Timeline | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Inicializar la animación
  useGSAP(() => {
    if (!iconRef.current || disabled) return;

    // Crear la animación
    animationRef.current = getAnimation(iconRef.current, animation, trigger);

    // Agregar callback si existe
    if (animationRef.current && onComplete) {
      animationRef.current.eventCallback('onComplete', onComplete);
    }

    // Cleanup
    return () => {
      if (animationRef.current) {
        animationRef.current.kill();
      }
    };
  }, { dependencies: [animation, trigger, disabled], scope: iconRef });

  // Handlers para trigger
  const handleMouseEnter = () => {
    if (trigger === 'hover' && animationRef.current && !disabled) {
      setIsHovered(true);
      animationRef.current.restart();
    }
  };

  const handleMouseLeave = () => {
    if (trigger === 'hover') {
      setIsHovered(false);
    }
  };

  const handleClick = () => {
    if (trigger === 'click' && animationRef.current && !disabled) {
      animationRef.current.restart();
    }
  };

  // Determinar event handlers según trigger
  const eventHandlers =
    trigger === 'hover'
      ? { onMouseEnter: handleMouseEnter, onMouseLeave: handleMouseLeave }
      : trigger === 'click'
      ? { onClick: handleClick }
      : {};

  // Agregar cursor pointer para triggers interactivos
  const interactiveTriggers: TriggerType[] = ['hover', 'click'];
  const cursorStyle = interactiveTriggers.includes(trigger) && !disabled
    ? { cursor: 'pointer' }
    : {};

  return (
    <span
      ref={iconRef}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...cursorStyle,
        ...style,
      }}
      {...eventHandlers}
    >
      {children}
    </span>
  );
};

export default AnimatedIcon;
