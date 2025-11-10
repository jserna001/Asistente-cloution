/**
 * Contextual Animations
 *
 * Configuraciones de animación que varían según el contexto:
 * - Modelo AI utilizado
 * - Estado de la aplicación
 * - Tipo de interacción
 */

import type { AnimationPreset } from '../../../components/IconAnimations/gsapPresets';
import type { ModelType, NotificationType } from '../contexts/AnimationContext';

// === ANIMACIONES POR MODELO AI ===

export interface ModelAnimationConfig {
  preset: AnimationPreset;
  intensity: 'subtle' | 'normal' | 'intense';
  color: string;
  icon: string;
  description: string;
}

export const MODEL_ANIMATIONS: Record<ModelType, ModelAnimationConfig> = {
  flash: {
    preset: 'glow',
    intensity: 'intense',
    color: '#fbbf24', // Amarillo/dorado - rápido como un rayo
    icon: 'zap',
    description: 'Gemini Flash - Rápido y eficiente',
  },
  pro: {
    preset: 'pulse',
    intensity: 'normal',
    color: '#8b5cf6', // Púrpura - inteligente y profesional
    icon: 'brain',
    description: 'Gemini Pro - Potente y preciso',
  },
  claude: {
    preset: 'float',
    intensity: 'subtle',
    color: '#3b82f6', // Azul - suave y conversacional
    icon: 'bot',
    description: 'Claude Sonnet - Versátil con MCP',
  },
  none: {
    preset: 'pulse',
    intensity: 'subtle',
    color: '#6b7280', // Gris
    icon: 'bot',
    description: 'Sin modelo específico',
  },
};

/**
 * Obtiene la configuración de animación para un modelo
 */
export const getModelAnimation = (model: ModelType): ModelAnimationConfig => {
  return MODEL_ANIMATIONS[model];
};

/**
 * Obtiene el preset de animación para un modelo
 */
export const getModelPreset = (model: ModelType): AnimationPreset => {
  return MODEL_ANIMATIONS[model].preset;
};

/**
 * Obtiene la intensidad de animación como duración
 */
export const getModelIntensity = (
  model: ModelType,
  baseDuration: number = 1
): number => {
  const intensity = MODEL_ANIMATIONS[model].intensity;

  switch (intensity) {
    case 'subtle':
      return baseDuration * 1.5; // Más lento = más sutil
    case 'normal':
      return baseDuration;
    case 'intense':
      return baseDuration * 0.7; // Más rápido = más intenso
    default:
      return baseDuration;
  }
};

// === ANIMACIONES POR ESTADO ===

export interface StateAnimationConfig {
  preset: AnimationPreset;
  color: string;
  duration: number;
  loop?: boolean;
}

export const STATE_ANIMATIONS = {
  loading: {
    preset: 'pulse' as AnimationPreset,
    color: '#3b82f6',
    duration: 1,
    loop: true,
  },
  success: {
    preset: 'tada' as AnimationPreset,
    color: '#10b981',
    duration: 0.8,
    loop: false,
  },
  error: {
    preset: 'shake' as AnimationPreset,
    color: '#ef4444',
    duration: 0.5,
    loop: false,
  },
  warning: {
    preset: 'wiggle' as AnimationPreset,
    color: '#f59e0b',
    duration: 0.6,
    loop: false,
  },
  info: {
    preset: 'bounce' as AnimationPreset,
    color: '#3b82f6',
    duration: 0.7,
    loop: false,
  },
  idle: {
    preset: 'float' as AnimationPreset,
    color: '#6b7280',
    duration: 3,
    loop: true,
  },
} as const;

/**
 * Obtiene la configuración de animación para un estado
 */
export const getStateAnimation = (
  state: keyof typeof STATE_ANIMATIONS
): StateAnimationConfig => {
  return STATE_ANIMATIONS[state];
};

// === ANIMACIONES POR TIPO DE NOTIFICACIÓN ===

export const NOTIFICATION_ANIMATIONS: Record<NotificationType, StateAnimationConfig> = {
  success: STATE_ANIMATIONS.success,
  error: STATE_ANIMATIONS.error,
  warning: STATE_ANIMATIONS.warning,
  info: STATE_ANIMATIONS.info,
};

/**
 * Obtiene la configuración de animación para una notificación
 */
export const getNotificationAnimation = (
  type: NotificationType
): StateAnimationConfig => {
  return NOTIFICATION_ANIMATIONS[type];
};

// === ANIMACIONES POR INTERACCIÓN ===

export interface InteractionAnimationConfig {
  hover: AnimationPreset;
  click: AnimationPreset;
  focus: AnimationPreset;
  active: AnimationPreset;
}

export const INTERACTION_ANIMATIONS = {
  button: {
    hover: 'bounce' as AnimationPreset,
    click: 'bounce' as AnimationPreset,
    focus: 'pulse' as AnimationPreset,
    active: 'tada' as AnimationPreset,
  },
  icon: {
    hover: 'float' as AnimationPreset,
    click: 'bounce' as AnimationPreset,
    focus: 'glow' as AnimationPreset,
    active: 'pulse' as AnimationPreset,
  },
  link: {
    hover: 'swing' as AnimationPreset,
    click: 'bounce' as AnimationPreset,
    focus: 'glow' as AnimationPreset,
    active: 'pulse' as AnimationPreset,
  },
  card: {
    hover: 'float' as AnimationPreset,
    click: 'tada' as AnimationPreset,
    focus: 'pulse' as AnimationPreset,
    active: 'glow' as AnimationPreset,
  },
} as const;

/**
 * Obtiene las animaciones de interacción para un elemento
 */
export const getInteractionAnimations = (
  element: keyof typeof INTERACTION_ANIMATIONS
): InteractionAnimationConfig => {
  return INTERACTION_ANIMATIONS[element];
};

// === HELPERS ===

/**
 * Combina múltiples configuraciones de animación
 */
export const combineAnimationConfigs = (
  ...configs: Partial<StateAnimationConfig>[]
): Partial<StateAnimationConfig> => {
  return configs.reduce(
    (acc, config) => ({ ...acc, ...config }),
    {} as Partial<StateAnimationConfig>
  );
};

/**
 * Adapta una configuración de animación según el rendimiento del dispositivo
 */
export const adaptAnimationToDevice = (
  config: StateAnimationConfig,
  isLowEnd: boolean
): StateAnimationConfig => {
  if (isLowEnd) {
    return {
      ...config,
      duration: config.duration * 0.7, // Más rápido en dispositivos lentos
      loop: false, // Sin loops en dispositivos lentos
    };
  }
  return config;
};

/**
 * Obtiene una animación aleatoria de una lista de presets
 */
export const getRandomAnimation = (
  presets: AnimationPreset[]
): AnimationPreset => {
  return presets[Math.floor(Math.random() * presets.length)];
};

// === ANIMACIONES ESPECIALES ===

/**
 * Animación de celebración (para logros, tareas completadas, etc.)
 */
export const CELEBRATION_ANIMATION: StateAnimationConfig = {
  preset: 'tada',
  color: '#10b981',
  duration: 1.2,
  loop: false,
};

/**
 * Animación de atención (para llamar la atención del usuario)
 */
export const ATTENTION_ANIMATION: StateAnimationConfig = {
  preset: 'heartbeat',
  color: '#ef4444',
  duration: 0.8,
  loop: true,
};

/**
 * Animación de procesamiento (para indicar que algo se está procesando)
 */
export const PROCESSING_ANIMATION: StateAnimationConfig = {
  preset: 'spin',
  color: '#3b82f6',
  duration: 1.5,
  loop: true,
};

// === CONFIGURACIONES POR PÁGINA ===

export const PAGE_SPECIFIC_ANIMATIONS = {
  chat: {
    messageEntry: 'bounce' as AnimationPreset,
    messageExit: 'float' as AnimationPreset,
    typingIndicator: 'pulse' as AnimationPreset,
    modelBadge: 'pop-in' as AnimationPreset, // CSS animation
  },
  login: {
    logo: 'float' as AnimationPreset,
    button: 'bounce' as AnimationPreset,
    sparkles: 'glow' as AnimationPreset,
  },
  settings: {
    tab: 'bounce' as AnimationPreset,
    save: 'tada' as AnimationPreset,
    toggle: 'flip' as AnimationPreset,
  },
  onboarding: {
    step: 'bounce' as AnimationPreset,
    progress: 'pulse' as AnimationPreset,
    complete: 'tada' as AnimationPreset,
  },
} as const;

/**
 * Obtiene las animaciones específicas de una página
 */
export const getPageAnimations = (
  page: keyof typeof PAGE_SPECIFIC_ANIMATIONS
) => {
  return PAGE_SPECIFIC_ANIMATIONS[page];
};
