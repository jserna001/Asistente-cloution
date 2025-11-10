/**
 * Providers Component
 *
 * Envuelve la aplicación con todos los providers necesarios
 */

'use client';

import React, { ReactNode } from 'react';
import { AnimationProvider, PerformanceMonitorProvider } from '@/lib/animations';
import { NotificationToast } from './NotificationToast';

interface ProvidersProps {
  children: ReactNode;
}

export const Providers: React.FC<ProvidersProps> = ({ children }) => {
  return (
    <PerformanceMonitorProvider
      enableInProduction={false} // Solo en desarrollo
      autoAdjust={true}
      targetFPS={30} // 30 FPS es suficiente para animaciones suaves
    >
      <AnimationProvider
        initialModel="none"
        respectReducedMotion={true}
      >
        {children}
        <NotificationToast />
      </AnimationProvider>
    </PerformanceMonitorProvider>
  );
};
