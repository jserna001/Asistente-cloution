/**
 * SkeletonLoader Component
 *
 * Skeleton screens con shimmer effect para estados de loading
 */

'use client';

import React, { CSSProperties } from 'react';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  variant?: 'text' | 'circular' | 'rectangular';
  animation?: 'pulse' | 'wave' | 'none';
  style?: CSSProperties;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '1em',
  borderRadius = 'var(--radius-md)',
  variant = 'rectangular',
  animation = 'wave',
  style = {},
}) => {
  // Configuración por variante
  const getVariantStyles = (): CSSProperties => {
    switch (variant) {
      case 'text':
        return {
          height: '1em',
          borderRadius: 'var(--radius-sm)',
        };
      case 'circular':
        return {
          borderRadius: '50%',
          width: height, // Para circular, width = height
        };
      case 'rectangular':
      default:
        return {
          borderRadius,
        };
    }
  };

  // Estilos de animación
  const getAnimationStyles = (): CSSProperties => {
    if (animation === 'none') return {};

    if (animation === 'pulse') {
      return {
        animation: 'skeleton-pulse 1.5s ease-in-out infinite',
      };
    }

    // Wave animation
    return {
      position: 'relative',
      overflow: 'hidden',
    };
  };

  return (
    <div
      className={`skeleton skeleton-${animation}`}
      style={{
        width,
        height,
        backgroundColor: 'var(--bg-tertiary)',
        ...getVariantStyles(),
        ...getAnimationStyles(),
        ...style,
      }}
    >
      {animation === 'wave' && <SkeletonWave />}
    </div>
  );
};

// Shimmer wave effect
const SkeletonWave: React.FC = () => (
  <div
    style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background:
        'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent)',
      animation: 'skeleton-wave 1.5s infinite',
    }}
  />
);

/**
 * SkeletonMessage - Skeleton para mensajes del chat
 */
export const SkeletonMessage: React.FC<{ sender?: 'user' | 'ai' }> = ({
  sender = 'ai',
}) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: sender === 'user' ? 'flex-end' : 'flex-start',
      gap: 'var(--space-2)',
      padding: 'var(--space-4)',
    }}
  >
    <div
      style={{
        width: '70%',
        padding: 'var(--space-4)',
        borderRadius: 'var(--radius-lg)',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-primary)',
      }}
    >
      <Skeleton width="100%" height="1em" style={{ marginBottom: 'var(--space-2)' }} />
      <Skeleton width="90%" height="1em" style={{ marginBottom: 'var(--space-2)' }} />
      <Skeleton width="80%" height="1em" />
    </div>

    {sender === 'ai' && (
      <div
        style={{
          display: 'flex',
          gap: 'var(--space-2)',
        }}
      >
        <Skeleton width="80px" height="24px" borderRadius="var(--radius-full)" />
        <Skeleton width="60px" height="24px" borderRadius="var(--radius-full)" />
      </div>
    )}
  </div>
);

/**
 * SkeletonCard - Skeleton para cards en Settings
 */
export const SkeletonCard: React.FC = () => (
  <div
    style={{
      padding: 'var(--space-6)',
      backgroundColor: 'var(--bg-secondary)',
      border: '1px solid var(--border-primary)',
      borderRadius: 'var(--radius-lg)',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
      <Skeleton variant="circular" width="48px" height="48px" />
      <div style={{ flex: 1 }}>
        <Skeleton width="150px" height="1.2em" style={{ marginBottom: 'var(--space-1)' }} />
        <Skeleton width="200px" height="0.9em" />
      </div>
    </div>
    <Skeleton width="100%" height="40px" />
  </div>
);

/**
 * SkeletonList - Skeleton para listas
 */
export const SkeletonList: React.FC<{ items?: number }> = ({ items = 3 }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
    {Array.from({ length: items }).map((_, i) => (
      <div
        key={i}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          padding: 'var(--space-3)',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-md)',
        }}
      >
        <Skeleton variant="circular" width="40px" height="40px" />
        <div style={{ flex: 1 }}>
          <Skeleton width="60%" height="1em" style={{ marginBottom: 'var(--space-1)' }} />
          <Skeleton width="40%" height="0.8em" />
        </div>
      </div>
    ))}
  </div>
);

/**
 * SkeletonTable - Skeleton para tablas
 */
export const SkeletonTable: React.FC<{ rows?: number; columns?: number }> = ({
  rows = 5,
  columns = 4,
}) => (
  <div>
    {/* Header */}
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: 'var(--space-2)',
        padding: 'var(--space-3)',
        borderBottom: '1px solid var(--border-primary)',
      }}
    >
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton key={i} width="80%" height="1em" />
      ))}
    </div>

    {/* Rows */}
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <div
        key={rowIndex}
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gap: 'var(--space-2)',
          padding: 'var(--space-3)',
          borderBottom: '1px solid var(--border-primary)',
        }}
      >
        {Array.from({ length: columns }).map((_, colIndex) => (
          <Skeleton key={colIndex} width="90%" height="1em" />
        ))}
      </div>
    ))}
  </div>
);

// Inyectar estilos CSS para las animaciones
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes skeleton-pulse {
      0%, 100% {
        opacity: 1;
      }
      50% {
        opacity: 0.5;
      }
    }

    @keyframes skeleton-wave {
      0% {
        transform: translateX(-100%);
      }
      100% {
        transform: translateX(100%);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .skeleton {
        animation: none !important;
      }
    }
  `;
  const existing = document.getElementById('skeleton-animations');
  if (!existing) {
    style.id = 'skeleton-animations';
    document.head.appendChild(style);
  }
}
