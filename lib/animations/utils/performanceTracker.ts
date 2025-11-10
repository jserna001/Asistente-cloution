/**
 * Performance Tracker & Analytics
 *
 * Sistema de tracking para analizar el uso y rendimiento de animaciones
 */

export interface AnimationEvent {
  type: 'start' | 'complete' | 'error' | 'cancel';
  animationId: string;
  animationName: string;
  timestamp: number;
  duration?: number;
  trigger?: string;
  metadata?: Record<string, any>;
}

export interface AnimationStats {
  animationName: string;
  totalExecutions: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  successRate: number;
  lastExecuted: number;
  triggers: Record<string, number>;
}

class PerformanceTracker {
  private events: AnimationEvent[] = [];
  private activeAnimations: Map<string, AnimationEvent> = new Map();
  private stats: Map<string, AnimationStats> = new Map();
  private maxEvents: number = 1000; // Límite de eventos guardados
  private enabled: boolean = true;

  constructor() {
    // Solo habilitar en desarrollo por defecto
    this.enabled = process.env.NODE_ENV === 'development';
  }

  /**
   * Habilitar o deshabilitar tracking
   */
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  /**
   * Trackear inicio de animación
   */
  trackStart(animationId: string, animationName: string, trigger?: string, metadata?: Record<string, any>) {
    if (!this.enabled) return;

    const event: AnimationEvent = {
      type: 'start',
      animationId,
      animationName,
      timestamp: performance.now(),
      trigger,
      metadata,
    };

    this.activeAnimations.set(animationId, event);
    this.addEvent(event);
  }

  /**
   * Trackear completación de animación
   */
  trackComplete(animationId: string) {
    if (!this.enabled) return;

    const startEvent = this.activeAnimations.get(animationId);
    if (!startEvent) {
      console.warn(`[PerformanceTracker] No start event found for animation: ${animationId}`);
      return;
    }

    const duration = performance.now() - startEvent.timestamp;

    const event: AnimationEvent = {
      type: 'complete',
      animationId,
      animationName: startEvent.animationName,
      timestamp: performance.now(),
      duration,
      trigger: startEvent.trigger,
    };

    this.activeAnimations.delete(animationId);
    this.addEvent(event);
    this.updateStats(startEvent.animationName, duration, true, startEvent.trigger);
  }

  /**
   * Trackear error en animación
   */
  trackError(animationId: string, error: Error) {
    if (!this.enabled) return;

    const startEvent = this.activeAnimations.get(animationId);
    if (!startEvent) return;

    const event: AnimationEvent = {
      type: 'error',
      animationId,
      animationName: startEvent.animationName,
      timestamp: performance.now(),
      metadata: { error: error.message },
    };

    this.activeAnimations.delete(animationId);
    this.addEvent(event);
    this.updateStats(startEvent.animationName, 0, false, startEvent.trigger);

    console.error(`[PerformanceTracker] Animation error:`, error);
  }

  /**
   * Trackear cancelación de animación
   */
  trackCancel(animationId: string) {
    if (!this.enabled) return;

    const startEvent = this.activeAnimations.get(animationId);
    if (!startEvent) return;

    const event: AnimationEvent = {
      type: 'cancel',
      animationId,
      animationName: startEvent.animationName,
      timestamp: performance.now(),
    };

    this.activeAnimations.delete(animationId);
    this.addEvent(event);
  }

  /**
   * Agregar evento al historial
   */
  private addEvent(event: AnimationEvent) {
    this.events.push(event);

    // Mantener solo los últimos N eventos
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }
  }

  /**
   * Actualizar estadísticas
   */
  private updateStats(
    animationName: string,
    duration: number,
    success: boolean,
    trigger?: string
  ) {
    let stats = this.stats.get(animationName);

    if (!stats) {
      stats = {
        animationName,
        totalExecutions: 0,
        avgDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
        successRate: 1,
        lastExecuted: Date.now(),
        triggers: {},
      };
      this.stats.set(animationName, stats);
    }

    stats.totalExecutions++;
    stats.lastExecuted = Date.now();

    if (success && duration > 0) {
      // Actualizar duración promedio
      const totalDuration = stats.avgDuration * (stats.totalExecutions - 1) + duration;
      stats.avgDuration = totalDuration / stats.totalExecutions;

      // Actualizar min/max
      stats.minDuration = Math.min(stats.minDuration, duration);
      stats.maxDuration = Math.max(stats.maxDuration, duration);

      // Calcular success rate
      const successCount = stats.successRate * (stats.totalExecutions - 1) + 1;
      stats.successRate = successCount / stats.totalExecutions;
    } else {
      // Actualizar success rate (fallo)
      const successCount = stats.successRate * (stats.totalExecutions - 1);
      stats.successRate = successCount / stats.totalExecutions;
    }

    // Trackear triggers
    if (trigger) {
      stats.triggers[trigger] = (stats.triggers[trigger] || 0) + 1;
    }
  }

  /**
   * Obtener estadísticas de una animación específica
   */
  getStats(animationName: string): AnimationStats | undefined {
    return this.stats.get(animationName);
  }

  /**
   * Obtener todas las estadísticas
   */
  getAllStats(): AnimationStats[] {
    return Array.from(this.stats.values());
  }

  /**
   * Obtener top N animaciones más usadas
   */
  getTopAnimations(n: number = 10): AnimationStats[] {
    return Array.from(this.stats.values())
      .sort((a, b) => b.totalExecutions - a.totalExecutions)
      .slice(0, n);
  }

  /**
   * Obtener animaciones más lentas
   */
  getSlowestAnimations(n: number = 10): AnimationStats[] {
    return Array.from(this.stats.values())
      .sort((a, b) => b.avgDuration - a.avgDuration)
      .slice(0, n);
  }

  /**
   * Obtener eventos recientes
   */
  getRecentEvents(n: number = 50): AnimationEvent[] {
    return this.events.slice(-n);
  }

  /**
   * Obtener animaciones activas en este momento
   */
  getActiveAnimations(): AnimationEvent[] {
    return Array.from(this.activeAnimations.values());
  }

  /**
   * Generar reporte completo
   */
  generateReport(): string {
    const stats = this.getAllStats();
    const totalAnimations = stats.reduce((sum, s) => sum + s.totalExecutions, 0);
    const avgSuccessRate = stats.reduce((sum, s) => sum + s.successRate, 0) / stats.length;

    let report = '\n=== 📊 Animation Performance Report ===\n\n';
    report += `Total Animations Executed: ${totalAnimations}\n`;
    report += `Unique Animation Types: ${stats.length}\n`;
    report += `Average Success Rate: ${(avgSuccessRate * 100).toFixed(2)}%\n`;
    report += `Currently Active: ${this.activeAnimations.size}\n\n`;

    report += '--- Top 10 Most Used Animations ---\n';
    this.getTopAnimations(10).forEach((stat, i) => {
      report += `${i + 1}. ${stat.animationName}: ${stat.totalExecutions} times `;
      report += `(avg: ${stat.avgDuration.toFixed(2)}ms)\n`;
    });

    report += '\n--- Slowest Animations ---\n';
    this.getSlowestAnimations(5).forEach((stat, i) => {
      report += `${i + 1}. ${stat.animationName}: ${stat.avgDuration.toFixed(2)}ms average `;
      report += `(min: ${stat.minDuration.toFixed(2)}ms, max: ${stat.maxDuration.toFixed(2)}ms)\n`;
    });

    report += '\n--- Trigger Distribution ---\n';
    const triggerStats: Record<string, number> = {};
    stats.forEach(stat => {
      Object.entries(stat.triggers).forEach(([trigger, count]) => {
        triggerStats[trigger] = (triggerStats[trigger] || 0) + count;
      });
    });
    Object.entries(triggerStats)
      .sort(([, a], [, b]) => b - a)
      .forEach(([trigger, count]) => {
        report += `${trigger}: ${count} times\n`;
      });

    report += '\n=====================================\n';

    return report;
  }

  /**
   * Log del reporte en consola
   */
  logReport() {
    console.log(this.generateReport());
  }

  /**
   * Limpiar datos
   */
  clear() {
    this.events = [];
    this.activeAnimations.clear();
    this.stats.clear();
  }

  /**
   * Exportar datos como JSON
   */
  exportData() {
    return {
      events: this.events,
      activeAnimations: Array.from(this.activeAnimations.entries()),
      stats: Array.from(this.stats.entries()),
      timestamp: Date.now(),
    };
  }
}

// Instancia singleton
export const performanceTracker = new PerformanceTracker();

// Exponer en window para debugging (solo en desarrollo)
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).__animationTracker = performanceTracker;
  console.log(
    '💡 Animation tracker available at: window.__animationTracker\n' +
    'Try: window.__animationTracker.logReport()'
  );
}

/**
 * Hook helper para auto-tracking de animaciones
 */
export const createTrackedAnimation = (
  animationName: string,
  animationFn: () => Promise<void> | void,
  trigger?: string
) => {
  const id = `${animationName}-${Date.now()}-${Math.random()}`;

  return async () => {
    performanceTracker.trackStart(id, animationName, trigger);

    try {
      await animationFn();
      performanceTracker.trackComplete(id);
    } catch (error) {
      performanceTracker.trackError(id, error as Error);
      throw error;
    }
  };
};
