/**
 * RippleEffect Component
 *
 * Material Design ripple effect para botones y elementos interactivos
 */

'use client';

import React, { useState, useRef, ReactNode, CSSProperties } from 'react';
import { gsap } from 'gsap';

interface Ripple {
  id: number;
  x: number;
  y: number;
  size: number;
}

interface RippleButtonProps {
  children: ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onClickAsync?: (e: React.MouseEvent<HTMLButtonElement>) => Promise<void>;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  rippleColor?: string;
  rippleDuration?: number;
  type?: 'button' | 'submit' | 'reset';
}

export const RippleButton: React.FC<RippleButtonProps> = ({
  children,
  onClick,
  onClickAsync,
  disabled = false,
  className = '',
  style = {},
  rippleColor = 'rgba(255, 255, 255, 0.6)',
  rippleDuration = 600,
  type = 'button',
}) => {
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const rippleIdCounter = useRef(0);

  const createRipple = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || !buttonRef.current) return;

    const button = buttonRef.current;
    const rect = button.getBoundingClientRect();

    // Calcular posición del click relativa al botón
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Calcular tamaño del ripple (diámetro del círculo que cubre todo el botón)
    const size = Math.max(rect.width, rect.height) * 2;

    const ripple: Ripple = {
      id: rippleIdCounter.current++,
      x,
      y,
      size,
    };

    setRipples((prev) => [...prev, ripple]);

    // Remover ripple después de la animación
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== ripple.id));
    }, rippleDuration);
  };

  const handleClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
    createRipple(event);

    if (onClick) {
      onClick(event);
    }

    if (onClickAsync) {
      await onClickAsync(event);
    }
  };

  return (
    <button
      ref={buttonRef}
      type={type}
      onClick={handleClick}
      disabled={disabled}
      className={className}
      style={{
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
    >
      {/* Contenido del botón */}
      <span style={{ position: 'relative', zIndex: 1 }}>{children}</span>

      {/* Ripples */}
      {ripples.map((ripple) => (
        <RippleSpan
          key={ripple.id}
          x={ripple.x}
          y={ripple.y}
          size={ripple.size}
          color={rippleColor}
          duration={rippleDuration}
        />
      ))}
    </button>
  );
};

// Componente individual de ripple
const RippleSpan: React.FC<{
  x: number;
  y: number;
  size: number;
  color: string;
  duration: number;
}> = ({ x, y, size, color, duration }) => {
  const rippleRef = useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    if (!rippleRef.current) return;

    const tl = gsap.timeline();

    // Animación del ripple: scale de 0 a 4, opacity de 1 a 0
    tl.to(rippleRef.current, {
      scale: 4,
      opacity: 0,
      duration: duration / 1000,
      ease: 'power2.out',
    });

    return () => {
      tl.kill();
    };
  }, [duration]);

  return (
    <span
      ref={rippleRef}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: size,
        height: size,
        borderRadius: '50%',
        transform: 'translate(-50%, -50%) scale(0)',
        backgroundColor: color,
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
};

/**
 * Hook para agregar ripple effect a elementos personalizados
 */
export const useRipple = (
  rippleColor: string = 'rgba(255, 255, 255, 0.6)',
  rippleDuration: number = 600
) => {
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const rippleIdCounter = useRef(0);

  const createRipple = (
    event: React.MouseEvent<HTMLElement>,
    elementRef: HTMLElement
  ) => {
    const rect = elementRef.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const size = Math.max(rect.width, rect.height) * 2;

    const ripple: Ripple = {
      id: rippleIdCounter.current++,
      x,
      y,
      size,
    };

    setRipples((prev) => [...prev, ripple]);

    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== ripple.id));
    }, rippleDuration);
  };

  const RippleContainer: React.FC<{
    children: ReactNode;
    style?: CSSProperties;
  }> = ({ children, style }) => (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
    >
      {children}
      {ripples.map((ripple) => (
        <RippleSpan
          key={ripple.id}
          x={ripple.x}
          y={ripple.y}
          size={ripple.size}
          color={rippleColor}
          duration={rippleDuration}
        />
      ))}
    </div>
  );

  return {
    createRipple,
    RippleContainer,
  };
};
