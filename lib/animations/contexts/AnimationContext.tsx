/**
 * Animation Context
 *
 * Provider global para gestionar el estado de animaciones en toda la aplicación.
 * Permite que las animaciones reaccionen al estado de la aplicación en tiempo real.
 */

'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { getDeviceCapabilities, getMobileOptimizedConfig } from '../utils/mobileDetector';

// === TYPES ===

export type ModelType = 'flash' | 'pro' | 'claude' | 'none';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  duration?: number; // ms, undefined = no auto-dismiss
  timestamp: number;
}

export interface AnimationContextValue {
  // Estados globales
  isLoading: boolean;
  hasNewMessages: boolean;
  currentModel: ModelType;
  errorState: boolean;
  successState: boolean;
  notifications: Notification[];

  // Configuración
  animationsEnabled: boolean;
  reducedMotion: boolean;
  deviceCapabilities: ReturnType<typeof getDeviceCapabilities>;
  mobileConfig: ReturnType<typeof getMobileOptimizedConfig>;

  // Métodos de estado
  setLoading: (loading: boolean) => void;
  setHasNewMessages: (hasNew: boolean) => void;
  setCurrentModel: (model: ModelType) => void;

  // Métodos de feedback
  triggerSuccess: (message?: string, duration?: number) => void;
  triggerError: (message?: string, duration?: number) => void;
  triggerInfo: (message?: string, duration?: number) => void;
  triggerWarning: (message?: string, duration?: number) => void;
  dismissNotification: (id: string) => void;

  // Control de animaciones
  enableAnimations: () => void;
  disableAnimations: () => void;
  toggleAnimations: () => void;
}

const AnimationContext = createContext<AnimationContextValue | null>(null);

// === HOOK ===

export const useAnimationContext = () => {
  const context = useContext(AnimationContext);
  if (!context) {
    throw new Error('useAnimationContext must be used within AnimationProvider');
  }
  return context;
};

// === PROVIDER ===

interface AnimationProviderProps {
  children: ReactNode;
  initialModel?: ModelType;
  respectReducedMotion?: boolean;
}

export const AnimationProvider: React.FC<AnimationProviderProps> = ({
  children,
  initialModel = 'none',
  respectReducedMotion = true,
}) => {
  // Estados
  const [isLoading, setIsLoading] = useState(false);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [currentModel, setCurrentModel] = useState<ModelType>(initialModel);
  const [errorState, setErrorState] = useState(false);
  const [successState, setSuccessState] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [animationsEnabled, setAnimationsEnabled] = useState(true);

  // Detección de capacidades
  const reducedMotion = useReducedMotion();
  const [deviceCapabilities] = useState(() => getDeviceCapabilities());
  const [mobileConfig] = useState(() => getMobileOptimizedConfig());

  // Auto-deshabilitar animaciones si prefers-reduced-motion
  useEffect(() => {
    if (respectReducedMotion && reducedMotion) {
      setAnimationsEnabled(false);
    }
  }, [reducedMotion, respectReducedMotion]);

  // === MÉTODOS DE ESTADO ===

  const setLoading = useCallback((loading: boolean) => {
    setIsLoading(loading);
  }, []);

  const setHasNewMessagesCallback = useCallback((hasNew: boolean) => {
    setHasNewMessages(hasNew);
  }, []);

  const setCurrentModelCallback = useCallback((model: ModelType) => {
    setCurrentModel(model);
  }, []);

  // === MÉTODOS DE FEEDBACK ===

  const addNotification = useCallback((
    type: NotificationType,
    message: string = '',
    duration: number = 3000
  ) => {
    const id = `${type}-${Date.now()}-${Math.random()}`;
    const notification: Notification = {
      id,
      type,
      message,
      duration,
      timestamp: Date.now(),
    };

    setNotifications((prev) => [...prev, notification]);

    // Actualizar estados de éxito/error
    if (type === 'success') {
      setSuccessState(true);
      setTimeout(() => setSuccessState(false), duration || 3000);
    } else if (type === 'error') {
      setErrorState(true);
      setTimeout(() => setErrorState(false), duration || 3000);
    }

    // Auto-dismiss si tiene duración
    if (duration) {
      setTimeout(() => {
        dismissNotification(id);
      }, duration);
    }

    return id;
  }, []);

  const triggerSuccess = useCallback((message?: string, duration?: number) => {
    addNotification('success', message || 'Operación exitosa', duration);
  }, [addNotification]);

  const triggerError = useCallback((message?: string, duration?: number) => {
    addNotification('error', message || 'Ocurrió un error', duration);
  }, [addNotification]);

  const triggerInfo = useCallback((message?: string, duration?: number) => {
    addNotification('info', message || 'Información', duration);
  }, [addNotification]);

  const triggerWarning = useCallback((message?: string, duration?: number) => {
    addNotification('warning', message || 'Advertencia', duration);
  }, [addNotification]);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // === CONTROL DE ANIMACIONES ===

  const enableAnimations = useCallback(() => {
    setAnimationsEnabled(true);
  }, []);

  const disableAnimations = useCallback(() => {
    setAnimationsEnabled(false);
  }, []);

  const toggleAnimations = useCallback(() => {
    setAnimationsEnabled((prev) => !prev);
  }, []);

  // === VALUE ===

  const value: AnimationContextValue = {
    // Estados
    isLoading,
    hasNewMessages,
    currentModel,
    errorState,
    successState,
    notifications,

    // Configuración
    animationsEnabled,
    reducedMotion,
    deviceCapabilities,
    mobileConfig,

    // Métodos de estado
    setLoading,
    setHasNewMessages: setHasNewMessagesCallback,
    setCurrentModel: setCurrentModelCallback,

    // Métodos de feedback
    triggerSuccess,
    triggerError,
    triggerInfo,
    triggerWarning,
    dismissNotification,

    // Control
    enableAnimations,
    disableAnimations,
    toggleAnimations,
  };

  return (
    <AnimationContext.Provider value={value}>
      {children}
    </AnimationContext.Provider>
  );
};

// === HOOKS AUXILIARES ===

/**
 * Hook para usar solo el estado de loading
 */
export const useLoadingState = () => {
  const { isLoading, setLoading } = useAnimationContext();
  return { isLoading, setLoading };
};

/**
 * Hook para usar solo el modelo actual
 */
export const useCurrentModel = () => {
  const { currentModel, setCurrentModel } = useAnimationContext();
  return { currentModel, setCurrentModel };
};

/**
 * Hook para usar solo las notificaciones
 */
export const useNotifications = () => {
  const {
    notifications,
    triggerSuccess,
    triggerError,
    triggerInfo,
    triggerWarning,
    dismissNotification,
  } = useAnimationContext();

  return {
    notifications,
    triggerSuccess,
    triggerError,
    triggerInfo,
    triggerWarning,
    dismissNotification,
  };
};

/**
 * Hook para verificar si las animaciones están habilitadas
 */
export const useAnimationsEnabled = () => {
  const { animationsEnabled, reducedMotion, mobileConfig } = useAnimationContext();
  return {
    enabled: animationsEnabled && !reducedMotion,
    complex: animationsEnabled && !reducedMotion && mobileConfig.enableComplexAnimations,
    particles: animationsEnabled && !reducedMotion && mobileConfig.enableParticleEffects,
    transitions: animationsEnabled || mobileConfig.enablePageTransitions,
  };
};
