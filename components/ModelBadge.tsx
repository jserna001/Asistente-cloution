/**
 * ModelBadge Component
 *
 * Badge animado que muestra el modelo AI utilizado con animaciones específicas por modelo
 */

'use client';

import React from 'react';
import { AnimatedIcon } from './Icons';
import { BotIcon, ZapIcon, BrainIcon } from './Icons';
import { getModelAnimation, getModelPreset } from '@/lib/animations';
import type { ModelType } from '@/lib/animations';

interface ModelBadgeProps {
  model: string;
  animated?: boolean;
  showLabel?: boolean;
  size?: number;
}

export const ModelBadge: React.FC<ModelBadgeProps> = ({
  model,
  animated = true,
  showLabel = true,
  size = 14,
}) => {
  // Determinar el tipo de modelo
  const getModelType = (modelName: string): ModelType => {
    if (modelName.includes('flash')) return 'flash';
    if (modelName.includes('2.5-pro') || modelName.includes('thinking')) return 'pro'; // Gemini Pro o con razonamiento
    if (modelName.includes('claude')) return 'claude';
    return 'none';
  };

  const modelType = getModelType(model);
  const animConfig = getModelAnimation(modelType);

  // Configuración de icono y label por modelo
  const getModelInfo = (modelName: string) => {
    if (modelName.includes('flash')) {
      return {
        icon: <ZapIcon size={size} />,
        label: 'Gemini Flash',
        color: animConfig.color,
      };
    } else if (modelName.includes('2.5-pro')) {
      return {
        icon: <BrainIcon size={size} />,
        label: 'Gemini Pro',
        color: animConfig.color,
      };
    } else if (modelName.includes('thinking')) {
      return {
        icon: <BrainIcon size={size} />,
        label: 'Gemini Thinking',
        color: animConfig.color,
      };
    } else if (modelName.includes('claude')) {
      return {
        icon: <BotIcon size={size} />,
        label: 'Claude Sonnet',
        color: animConfig.color,
      };
    }
    return {
      icon: <BrainIcon size={size} />,
      label: model,
      color: 'var(--text-secondary)',
    };
  };

  const { icon, label, color } = getModelInfo(model);

  // Renderizar icono con o sin animación
  const renderIcon = () => {
    if (animated && modelType !== 'none') {
      return (
        <AnimatedIcon
          animation={animConfig.preset}
          trigger="loop"
          style={{ display: 'flex' }}
        >
          {icon}
        </AnimatedIcon>
      );
    }
    return <span style={{ display: 'flex' }}>{icon}</span>;
  };

  return (
    <span
      className="model-badge icon-pop-in"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-1)',
        padding: 'var(--space-1) var(--space-2)',
        borderRadius: 'var(--radius-full)',
        backgroundColor: `${color}15`,
        color: color,
        fontSize: 'var(--text-xs)',
        fontWeight: 'var(--font-medium)',
        border: `1px solid ${color}30`,
        position: 'relative',
        overflow: 'hidden',
      }}
      title={animConfig.description}
    >
      {/* Efecto de brillo sutil para modelos específicos */}
      {modelType === 'flash' && (
        <span
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: `linear-gradient(90deg, transparent, ${color}20, transparent)`,
            animation: 'shimmer 2s infinite',
            pointerEvents: 'none',
          }}
        />
      )}

      {renderIcon()}
      {showLabel && label}
    </span>
  );
};

// Agregar keyframes para el shimmer effect (si no existe en design-system.css)
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes shimmer {
      0% {
        transform: translateX(-100%);
      }
      100% {
        transform: translateX(100%);
      }
    }
  `;
  const existing = document.getElementById('model-badge-animations');
  if (!existing) {
    style.id = 'model-badge-animations';
    document.head.appendChild(style);
  }
}
