/**
 * Mobile Detector & Optimization
 *
 * Detecta dispositivos móviles y ajusta animaciones para mejor rendimiento
 */

export interface DeviceCapabilities {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isLowEnd: boolean;
  isTouchDevice: boolean;
  screenSize: 'small' | 'medium' | 'large';
  hardwareConcurrency: number;
  memoryGB?: number;
  connectionSpeed: 'slow' | 'medium' | 'fast';
}

/**
 * Detecta si el dispositivo es móvil
 */
export const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined') return false;

  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;

  // Regex para detectar dispositivos móviles
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

  return mobileRegex.test(userAgent);
};

/**
 * Detecta si el dispositivo es una tablet
 */
export const isTabletDevice = (): boolean => {
  if (typeof window === 'undefined') return false;

  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;

  // Tablets tienen pantallas más grandes pero son móviles
  const isIPad = /iPad/i.test(userAgent);
  const isAndroidTablet = /Android/i.test(userAgent) && !/Mobile/i.test(userAgent);

  // Detectar tablets por tamaño de pantalla (ancho > 768px)
  const isLargeScreen = window.innerWidth >= 768 && window.innerWidth < 1024;

  return isIPad || isAndroidTablet || (isMobileDevice() && isLargeScreen);
};

/**
 * Detecta si el dispositivo soporta touch
 */
export const isTouchDevice = (): boolean => {
  if (typeof window === 'undefined') return false;

  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    (navigator as any).msMaxTouchPoints > 0
  );
};

/**
 * Detecta si el dispositivo es de gama baja
 */
export const isLowEndDevice = (): boolean => {
  if (typeof window === 'undefined') return false;

  // Número de cores de CPU
  const cores = navigator.hardwareConcurrency || 4;

  // Memoria RAM (si está disponible)
  const memory = (navigator as any).deviceMemory; // En GB

  // Consideramos low-end si:
  // - Tiene 4 o menos cores
  // - Tiene 4GB o menos de RAM
  const isLowCPU = cores <= 4;
  const isLowRAM = memory && memory <= 4;

  return isLowCPU || isLowRAM;
};

/**
 * Obtiene el tamaño de pantalla categorizado
 */
export const getScreenSize = (): 'small' | 'medium' | 'large' => {
  if (typeof window === 'undefined') return 'medium';

  const width = window.innerWidth;

  if (width < 640) return 'small';   // Mobile
  if (width < 1024) return 'medium'; // Tablet
  return 'large';                     // Desktop
};

/**
 * Detecta la velocidad de conexión
 */
export const getConnectionSpeed = (): 'slow' | 'medium' | 'fast' => {
  if (typeof window === 'undefined') return 'medium';

  const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;

  if (!connection) return 'medium';

  // effectiveType puede ser: 'slow-2g', '2g', '3g', '4g'
  const effectiveType = connection.effectiveType;

  if (effectiveType === 'slow-2g' || effectiveType === '2g') {
    return 'slow';
  }

  if (effectiveType === '3g') {
    return 'medium';
  }

  return 'fast'; // 4g o mejor
};

/**
 * Obtiene todas las capacidades del dispositivo
 */
export const getDeviceCapabilities = (): DeviceCapabilities => {
  const isMobile = isMobileDevice();
  const isTablet = isTabletDevice();

  return {
    isMobile,
    isTablet,
    isDesktop: !isMobile && !isTablet,
    isLowEnd: isLowEndDevice(),
    isTouchDevice: isTouchDevice(),
    screenSize: getScreenSize(),
    hardwareConcurrency: navigator.hardwareConcurrency || 4,
    memoryGB: (navigator as any).deviceMemory,
    connectionSpeed: getConnectionSpeed(),
  };
};

/**
 * Obtiene configuración de animación optimizada para el dispositivo
 */
export interface MobileAnimationConfig {
  enableComplexAnimations: boolean;
  enableParticleEffects: boolean;
  enableBlurEffects: boolean;
  maxSimultaneousAnimations: number;
  reducedDuration: boolean;
  enablePageTransitions: boolean;
  enableMicrointeractions: boolean;
  useSimplifiedSkeletons: boolean;
}

export const getMobileOptimizedConfig = (): MobileAnimationConfig => {
  const capabilities = getDeviceCapabilities();

  // Configuración para desktop de alta gama
  if (capabilities.isDesktop && !capabilities.isLowEnd) {
    return {
      enableComplexAnimations: true,
      enableParticleEffects: true,
      enableBlurEffects: true,
      maxSimultaneousAnimations: 15,
      reducedDuration: false,
      enablePageTransitions: true,
      enableMicrointeractions: true,
      useSimplifiedSkeletons: false,
    };
  }

  // Configuración para tablets
  if (capabilities.isTablet) {
    return {
      enableComplexAnimations: true,
      enableParticleEffects: true,
      enableBlurEffects: false, // Blur es pesado en tablets
      maxSimultaneousAnimations: 8,
      reducedDuration: false,
      enablePageTransitions: true,
      enableMicrointeractions: true,
      useSimplifiedSkeletons: false,
    };
  }

  // Configuración para móviles de gama alta
  if (capabilities.isMobile && !capabilities.isLowEnd) {
    return {
      enableComplexAnimations: false, // Evitar timelines complejas
      enableParticleEffects: false,   // Partículas son pesadas
      enableBlurEffects: false,
      maxSimultaneousAnimations: 5,
      reducedDuration: true,
      enablePageTransitions: true,
      enableMicrointeractions: true,
      useSimplifiedSkeletons: true,
    };
  }

  // Configuración para móviles de gama baja
  return {
    enableComplexAnimations: false,
    enableParticleEffects: false,
    enableBlurEffects: false,
    maxSimultaneousAnimations: 2,
    reducedDuration: true,
    enablePageTransitions: false, // Solo CSS transitions
    enableMicrointeractions: false,
    useSimplifiedSkeletons: true,
  };
};

/**
 * Hook de React para usar capacidades del dispositivo
 * (Se implementará en hooks/useDeviceCapabilities.ts)
 */
export const createDeviceCapabilitiesHook = () => {
  // Placeholder para el hook que se creará después
  return getDeviceCapabilities;
};

/**
 * Log de información del dispositivo (útil para debugging)
 */
export const logDeviceInfo = () => {
  if (typeof window === 'undefined') return;

  const capabilities = getDeviceCapabilities();
  const config = getMobileOptimizedConfig();

  console.group('🔍 Device Capabilities');
  console.log('Device Type:', {
    isMobile: capabilities.isMobile,
    isTablet: capabilities.isTablet,
    isDesktop: capabilities.isDesktop,
  });
  console.log('Performance:', {
    isLowEnd: capabilities.isLowEnd,
    cores: capabilities.hardwareConcurrency,
    memory: capabilities.memoryGB ? `${capabilities.memoryGB} GB` : 'Unknown',
  });
  console.log('Screen:', {
    size: capabilities.screenSize,
    dimensions: `${window.innerWidth}x${window.innerHeight}`,
  });
  console.log('Connection:', capabilities.connectionSpeed);
  console.log('Animation Config:', config);
  console.groupEnd();
};

// Log automático en desarrollo
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  // Esperar a que el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', logDeviceInfo);
  } else {
    logDeviceInfo();
  }
}
