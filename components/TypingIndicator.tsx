/**
 * TypingIndicator Component
 *
 * Indicador de "pensando..." con animación ondulante de 3 dots usando GSAP sequence
 */

'use client';

import React, { useRef, useEffect } from 'react';
import { useStaggerSequence } from '@/lib/animations';

interface TypingIndicatorProps {
  message?: string;
  context?: string; // Contexto de la acción que está realizando
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({
  message,
  context,
}) => {
  // Determinar mensaje contextual basado en el contexto
  const getContextualMessage = () => {
    if (message) return message;
    if (!context) return '🤔 Pensando...';

    const lowerContext = context.toLowerCase();

    if (lowerContext.includes('gmail') || lowerContext.includes('email') || lowerContext.includes('correo')) {
      return '📧 Buscando en tus correos...';
    }
    if (lowerContext.includes('notion') || lowerContext.includes('task') || lowerContext.includes('tarea')) {
      return '📝 Consultando Notion...';
    }
    if (lowerContext.includes('browser') || lowerContext.includes('web') || lowerContext.includes('naveg')) {
      return '🌐 Navegando en la web...';
    }
    if (lowerContext.includes('calendar') || lowerContext.includes('calendario') || lowerContext.includes('evento')) {
      return '📅 Revisando tu calendario...';
    }
    if (lowerContext.includes('rag') || lowerContext.includes('document') || lowerContext.includes('search')) {
      return '🔍 Buscando en tus documentos...';
    }
    if (lowerContext.includes('summary') || lowerContext.includes('resumen')) {
      return '✨ Generando resumen...';
    }

    return '🤔 Pensando...';
  };

  const displayMessage = getContextualMessage();
  const dotsRef = useRef<HTMLElement[]>([]);

  // Aplicar secuencia de typing indicator a los dots
  useStaggerSequence('typingIndicator', dotsRef as any, {
    autoplay: true,
    respectReducedMotion: true,
  });

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        padding: 'var(--space-4)',
        borderRadius: 'var(--radius-lg)',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-primary)',
        maxWidth: '80%',
      }}
    >
      {/* Dots container */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-1)',
        }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            ref={(el) => {
              if (el) dotsRef.current[i] = el;
            }}
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: 'var(--accent-blue)',
            }}
          />
        ))}
      </div>

      {/* Message */}
      <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{displayMessage}</p>
    </div>
  );
};
