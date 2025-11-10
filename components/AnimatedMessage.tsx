/**
 * AnimatedMessage Component
 *
 * Wrapper para mensajes del chat con animación de entrada usando GSAP sequences
 */

'use client';

import React, { useRef, ReactNode } from 'react';
import { useSequence } from '@/lib/animations';

interface AnimatedMessageProps {
  children: ReactNode;
  sender: 'user' | 'ai';
  autoplay?: boolean;
}

export const AnimatedMessage: React.FC<AnimatedMessageProps> = ({
  children,
  sender,
  autoplay = true,
}) => {
  const messageRef = useRef<HTMLDivElement>(null);

  // Aplicar secuencia de entrada
  useSequence('messageEntry', messageRef, {
    autoplay,
    respectReducedMotion: true,
    trackPerformance: true,
  });

  return (
    <div
      ref={messageRef}
      className="message-item"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: sender === 'user' ? 'flex-end' : 'flex-start',
        gap: 'var(--space-2)',
      }}
    >
      {children}
    </div>
  );
};
