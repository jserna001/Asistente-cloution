/**
 * Animation System - Central Exports
 *
 * Sistema completo de animaciones para el proyecto
 * Exporta todos los módulos de forma centralizada
 */

// === UTILS ===
export {
  loadScrollTrigger,
  loadMotionPath,
  loadAllGSAPPlugins,
  LazyConfetti,
  LazyRippleEffect,
  LazySkeletonLoader,
  LazyDragFeedback,
  preloadComponent,
  cleanupAnimations,
  optimizeGSAP,
  shouldEnableAnimations,
  getOptimizedAnimationConfig,
  type AnimationConfig as OptimizedAnimationConfig,
} from './utils/animationOptimizer';

export {
  isMobileDevice,
  isTabletDevice,
  isTouchDevice,
  isLowEndDevice,
  getScreenSize,
  getConnectionSpeed,
  getDeviceCapabilities,
  getMobileOptimizedConfig,
  logDeviceInfo,
  type DeviceCapabilities,
  type MobileAnimationConfig,
} from './utils/mobileDetector';

export {
  performanceTracker,
  createTrackedAnimation,
  type AnimationEvent,
  type AnimationStats,
} from './utils/performanceTracker';

// === CONTEXTS ===
export {
  PerformanceMonitorProvider,
  usePerformanceMonitor,
  useAnimationTracking,
} from './contexts/PerformanceMonitor';

export {
  AnimationProvider,
  useAnimationContext,
  useLoadingState,
  useCurrentModel,
  useNotifications,
  useAnimationsEnabled,
  type ModelType,
  type NotificationType,
  type Notification,
  type AnimationContextValue,
} from './contexts/AnimationContext';

// === HOOKS ===
export {
  useReducedMotion,
  useAnimationDuration,
  useAnimationConfig,
  useApplyReducedMotionStyles,
  type AnimationConfig,
} from './hooks/useReducedMotion';

export {
  useSequence,
  useSequenceOnce,
  useStaggerSequence,
  type UseSequenceOptions,
  type UseSequenceReturn,
} from './hooks/useSequence';

// === ORCHESTRATION ===
export {
  getModelAnimation,
  getModelPreset,
  getModelIntensity,
  getStateAnimation,
  getNotificationAnimation,
  getInteractionAnimations,
  combineAnimationConfigs,
  adaptAnimationToDevice,
  getRandomAnimation,
  getPageAnimations,
  MODEL_ANIMATIONS,
  STATE_ANIMATIONS,
  NOTIFICATION_ANIMATIONS,
  INTERACTION_ANIMATIONS,
  CELEBRATION_ANIMATION,
  ATTENTION_ANIMATION,
  PROCESSING_ANIMATION,
  PAGE_SPECIFIC_ANIMATIONS,
  type ModelAnimationConfig,
  type StateAnimationConfig,
  type InteractionAnimationConfig,
} from './orchestration/contextualAnimations';

export {
  typingIndicator,
  messageEntry,
  messageExit,
  taskComplete,
  errorShake,
  staggerFadeIn,
  staggerSlideIn,
  logoReveal,
  cardFlip,
  confettiBurst,
  getSequence,
  SEQUENCE_PRESETS,
  type SequencePresetName,
  type SequenceConfig,
} from './orchestration/sequencePresets';

// === RE-EXPORTS from components ===
// Estos se exportan desde components/Icons.tsx, pero los re-exportamos aquí por conveniencia
export type { AnimationPreset, TriggerType } from '../components/IconAnimations/gsapPresets';
