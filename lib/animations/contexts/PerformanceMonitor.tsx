/**
 * Performance Monitor
 *
 * Monitorea el rendimiento de las animaciones en tiempo real:
 * - FPS (frames per second)
 * - Tiempo de ejecución de timelines
 * - Número de animaciones activas
 * - Detección de jank (frames caídos)
 */

'use client';

import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { gsap } from 'gsap';

interface PerformanceMetrics {
  fps: number;
  avgFps: number;
  activeAnimations: number;
  totalAnimations: number;
  droppedFrames: number;
  isJanky: boolean;
  lastMeasurement: number;
}

interface PerformanceMonitorContextValue {
  metrics: PerformanceMetrics;
  startTracking: (id: string) => void;
  stopTracking: (id: string) => void;
  isMonitoring: boolean;
  toggleMonitoring: () => void;
}

const PerformanceMonitorContext = createContext<PerformanceMonitorContextValue | null>(null);

export const usePerformanceMonitor = () => {
  const context = useContext(PerformanceMonitorContext);
  if (!context) {
    throw new Error('usePerformanceMonitor must be used within PerformanceMonitorProvider');
  }
  return context;
};

interface PerformanceMonitorProviderProps {
  children: ReactNode;
  enableInProduction?: boolean;
  autoAdjust?: boolean; // Ajustar automáticamente animaciones si FPS baja
  targetFPS?: number;
}

export const PerformanceMonitorProvider: React.FC<PerformanceMonitorProviderProps> = ({
  children,
  enableInProduction = false,
  autoAdjust = true,
  targetFPS = 30,
}) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 60,
    avgFps: 60,
    activeAnimations: 0,
    totalAnimations: 0,
    droppedFrames: 0,
    isJanky: false,
    lastMeasurement: Date.now(),
  });

  const [isMonitoring, setIsMonitoring] = useState(
    process.env.NODE_ENV === 'development' || enableInProduction
  );

  const frameTimesRef = useRef<number[]>([]);
  const lastFrameTimeRef = useRef<number>(performance.now());
  const animationFrameIdRef = useRef<number | null>(null);
  const activeAnimationsRef = useRef<Set<string>>(new Set());
  const totalAnimationsRef = useRef<number>(0);
  const droppedFramesRef = useRef<number>(0);

  // Medir FPS
  const measureFPS = () => {
    const now = performance.now();
    const delta = now - lastFrameTimeRef.current;
    lastFrameTimeRef.current = now;

    // Calcular FPS instantáneo
    const instantFps = 1000 / delta;

    // Guardar últimos 60 frames para calcular promedio
    frameTimesRef.current.push(instantFps);
    if (frameTimesRef.current.length > 60) {
      frameTimesRef.current.shift();
    }

    // Calcular FPS promedio
    const avgFps = frameTimesRef.current.reduce((sum, fps) => sum + fps, 0) / frameTimesRef.current.length;

    // Detectar frames caídos (si FPS < 30 en desktop)
    const isLowFPS = instantFps < targetFPS;
    if (isLowFPS) {
      droppedFramesRef.current++;
    }

    // Detectar jank (variación significativa en FPS)
    const fpsVariance = Math.abs(instantFps - avgFps);
    const isJanky = fpsVariance > 15;

    // Actualizar métricas
    setMetrics({
      fps: Math.round(instantFps),
      avgFps: Math.round(avgFps),
      activeAnimations: activeAnimationsRef.current.size,
      totalAnimations: totalAnimationsRef.current,
      droppedFrames: droppedFramesRef.current,
      isJanky,
      lastMeasurement: Date.now(),
    });

    // Auto-ajuste si está habilitado
    if (autoAdjust && avgFps < targetFPS && activeAnimationsRef.current.size > 0) {
      handleLowPerformance();
    }

    // Continuar midiendo
    if (isMonitoring) {
      animationFrameIdRef.current = requestAnimationFrame(measureFPS);
    }
  };

  // Manejar bajo rendimiento
  const handleLowPerformance = () => {
    console.warn(
      `[PerformanceMonitor] Low FPS detected (${metrics.avgFps}). ` +
      `Consider reducing animation complexity or disabling some effects.`
    );

    // Opcional: Reducir calidad de animaciones automáticamente
    // gsap.globalTimeline.timeScale(1.5); // Acelerar animaciones
    // o deshabilitar efectos pesados
  };

  // Iniciar tracking de una animación
  const startTracking = (id: string) => {
    activeAnimationsRef.current.add(id);
    totalAnimationsRef.current++;
  };

  // Detener tracking de una animación
  const stopTracking = (id: string) => {
    activeAnimationsRef.current.delete(id);
  };

  // Toggle monitoring
  const toggleMonitoring = () => {
    setIsMonitoring((prev) => !prev);
  };

  // Iniciar medición de FPS
  useEffect(() => {
    if (isMonitoring) {
      lastFrameTimeRef.current = performance.now();
      animationFrameIdRef.current = requestAnimationFrame(measureFPS);
    } else {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    }

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [isMonitoring]);

  // Log de advertencias en desarrollo
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      if (metrics.avgFps < targetFPS) {
        console.warn(
          `[PerformanceMonitor] Average FPS: ${metrics.avgFps} (below target of ${targetFPS})`
        );
      }

      if (metrics.isJanky) {
        console.warn('[PerformanceMonitor] Frame jank detected');
      }

      if (metrics.activeAnimations > 10) {
        console.warn(
          `[PerformanceMonitor] High number of active animations: ${metrics.activeAnimations}`
        );
      }
    }
  }, [metrics.avgFps, metrics.isJanky, metrics.activeAnimations]);

  const value: PerformanceMonitorContextValue = {
    metrics,
    startTracking,
    stopTracking,
    isMonitoring,
    toggleMonitoring,
  };

  return (
    <PerformanceMonitorContext.Provider value={value}>
      {children}
      {isMonitoring && process.env.NODE_ENV === 'development' && (
        <PerformanceMonitorOverlay metrics={metrics} />
      )}
    </PerformanceMonitorContext.Provider>
  );
};

/**
 * Overlay visual para mostrar métricas en desarrollo
 */
const PerformanceMonitorOverlay: React.FC<{ metrics: PerformanceMetrics }> = ({ metrics }) => {
  const getFPSColor = (fps: number) => {
    if (fps >= 55) return '#4ade80'; // Verde
    if (fps >= 30) return '#fbbf24'; // Amarillo
    return '#ef4444'; // Rojo
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        background: 'rgba(0, 0, 0, 0.85)',
        color: 'white',
        padding: '12px 16px',
        borderRadius: '8px',
        fontFamily: 'monospace',
        fontSize: '12px',
        zIndex: 999999,
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        minWidth: '200px',
      }}
    >
      <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '14px' }}>
        ⚡ Performance Monitor
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span>FPS:</span>
        <span style={{ color: getFPSColor(metrics.fps), fontWeight: 'bold' }}>
          {metrics.fps}
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span>Avg FPS:</span>
        <span style={{ color: getFPSColor(metrics.avgFps), fontWeight: 'bold' }}>
          {metrics.avgFps}
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span>Active:</span>
        <span>{metrics.activeAnimations}</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span>Total:</span>
        <span>{metrics.totalAnimations}</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span>Dropped:</span>
        <span style={{ color: metrics.droppedFrames > 10 ? '#ef4444' : '#4ade80' }}>
          {metrics.droppedFrames}
        </span>
      </div>

      {metrics.isJanky && (
        <div
          style={{
            marginTop: '8px',
            padding: '4px 8px',
            background: '#ef4444',
            borderRadius: '4px',
            textAlign: 'center',
            fontSize: '11px',
          }}
        >
          ⚠️ JANK DETECTED
        </div>
      )}
    </div>
  );
};

/**
 * Hook para trackear una animación específica
 */
export const useAnimationTracking = (animationId: string, enabled: boolean = true) => {
  const { startTracking, stopTracking } = usePerformanceMonitor();

  useEffect(() => {
    if (enabled) {
      startTracking(animationId);
      return () => {
        stopTracking(animationId);
      };
    }
  }, [animationId, enabled, startTracking, stopTracking]);
};
