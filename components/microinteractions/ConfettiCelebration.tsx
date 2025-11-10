/**
 * ConfettiCelebration Component
 *
 * Celebración con confetti animado usando GSAP (sin dependencias externas)
 */

'use client';

import React, { useRef, useEffect, useState } from 'react';
import { gsap } from 'gsap';

interface ConfettiParticle {
  id: number;
  x: number;
  y: number;
  rotation: number;
  color: string;
  size: number;
  velocityX: number;
  velocityY: number;
  rotationSpeed: number;
}

interface ConfettiProps {
  active?: boolean;
  duration?: number;
  particleCount?: number;
  origin?: { x: number; y: number };
  colors?: string[];
  onComplete?: () => void;
}

export const ConfettiCelebration: React.FC<ConfettiProps> = ({
  active = false,
  duration = 3000,
  particleCount = 50,
  origin = { x: 0.5, y: 0.5 },
  colors = [
    '#ff0000',
    '#00ff00',
    '#0000ff',
    '#ffff00',
    '#ff00ff',
    '#00ffff',
    '#ffa500',
    '#ff1493',
  ],
  onComplete,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [particles, setParticles] = useState<ConfettiParticle[]>([]);

  useEffect(() => {
    if (!active || !containerRef.current) return;

    const container = containerRef.current;
    const rect = container.getBoundingClientRect();

    // Generar partículas
    const newParticles: ConfettiParticle[] = Array.from(
      { length: particleCount },
      (_, i) => {
        const angle = (Math.random() * Math.PI * 2);
        const velocity = Math.random() * 10 + 5;

        return {
          id: i,
          x: rect.width * origin.x,
          y: rect.height * origin.y,
          rotation: Math.random() * 360,
          color: colors[Math.floor(Math.random() * colors.length)],
          size: Math.random() * 10 + 5,
          velocityX: Math.cos(angle) * velocity,
          velocityY: Math.sin(angle) * velocity - Math.random() * 5,
          rotationSpeed: (Math.random() - 0.5) * 720,
        };
      }
    );

    setParticles(newParticles);

    // Animar partículas
    newParticles.forEach((particle) => {
      const element = container.querySelector(`#confetti-${particle.id}`);
      if (!element) return;

      gsap.to(element, {
        x: `+=${particle.velocityX * 100}`,
        y: `+=${particle.velocityY * 50 + 500}`, // Caída con gravedad
        rotation: `+=${particle.rotationSpeed}`,
        opacity: 0,
        duration: duration / 1000,
        ease: 'power2.out',
      });
    });

    // Limpiar después de la animación
    const timeout = setTimeout(() => {
      setParticles([]);
      if (onComplete) onComplete();
    }, duration);

    return () => {
      clearTimeout(timeout);
    };
  }, [active, duration, particleCount, origin, colors, onComplete]);

  if (!active && particles.length === 0) return null;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 9998,
        overflow: 'hidden',
      }}
    >
      {particles.map((particle) => (
        <div
          key={particle.id}
          id={`confetti-${particle.id}`}
          style={{
            position: 'absolute',
            left: particle.x,
            top: particle.y,
            width: particle.size,
            height: particle.size,
            backgroundColor: particle.color,
            transform: `rotate(${particle.rotation}deg)`,
            borderRadius: Math.random() > 0.5 ? '50%' : '0%',
          }}
        />
      ))}
    </div>
  );
};

/**
 * Hook para disparar confetti programáticamente
 */
export const useConfetti = () => {
  const [active, setActive] = useState(false);

  const fire = (config?: Partial<ConfettiProps>) => {
    setActive(true);

    const duration = config?.duration || 3000;
    setTimeout(() => {
      setActive(false);
    }, duration);
  };

  const ConfettiContainer: React.FC<Partial<ConfettiProps>> = (props) => (
    <ConfettiCelebration active={active} {...props} />
  );

  return {
    fire,
    active,
    ConfettiContainer,
  };
};

/**
 * Preset de confetti para diferentes ocasiones
 */
export const confettiPresets = {
  default: {
    particleCount: 50,
    duration: 3000,
    colors: [
      '#ff0000',
      '#00ff00',
      '#0000ff',
      '#ffff00',
      '#ff00ff',
      '#00ffff',
    ],
  },
  celebration: {
    particleCount: 100,
    duration: 5000,
    colors: ['#ffd700', '#ff6347', '#ff1493', '#00ff00', '#1e90ff'],
  },
  success: {
    particleCount: 30,
    duration: 2000,
    colors: ['#10b981', '#34d399', '#6ee7b7'],
  },
  birthday: {
    particleCount: 150,
    duration: 6000,
    colors: [
      '#ff69b4',
      '#ff1493',
      '#ffd700',
      '#ffff00',
      '#00ff00',
      '#00ffff',
      '#1e90ff',
      '#8a2be2',
    ],
  },
};

/**
 * Componente simple para botón con confetti
 */
export const ConfettiButton: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  preset?: keyof typeof confettiPresets;
  style?: React.CSSProperties;
}> = ({ children, onClick, preset = 'default', style }) => {
  const { fire, ConfettiContainer } = useConfetti();

  const handleClick = () => {
    fire(confettiPresets[preset]);
    if (onClick) onClick();
  };

  return (
    <>
      <button onClick={handleClick} style={style}>
        {children}
      </button>
      <ConfettiContainer {...confettiPresets[preset]} />
    </>
  );
};
