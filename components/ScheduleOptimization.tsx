'use client';

import { useState, useEffect } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabaseClient';

/**
 * FASE 3: Componente de Optimización de Horario
 *
 * Muestra sugerencias de horario basadas en análisis de engagement
 * y permite al usuario aplicarlas automáticamente.
 *
 * Uso:
 * import ScheduleOptimization from '@/components/ScheduleOptimization';
 * <ScheduleOptimization />
 */

interface ScheduleSuggestion {
  hasEnoughData: boolean;
  dataPoints: number;
  currentSchedule: {
    time: string;
    hour: number;
    ctr: number;
    avgResponseTime: number;
  };
  suggestedSchedule: {
    time: string;
    hour: number;
    ctr: number;
    avgResponseTime: number;
    potentialImprovement: number;
  };
  shouldChange: boolean;
  recommendation: string;
  insights: string[];
  allPatterns: Array<{
    hour: number;
    ctr: number;
    avgResponseTimeMinutes: number;
    totalSummaries: number;
  }>;
}

export default function ScheduleOptimization() {
  const supabase = createSupabaseBrowserClient();
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const [suggestion, setSuggestion] = useState<ScheduleSuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    loadSuggestions();
  }, []);

  const loadSuggestions = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Sesión no válida');
        return;
      }

      const response = await fetch('/api/user/schedule-suggestions', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        throw new Error('Error cargando sugerencias');
      }

      const data = await response.json();
      setSuggestion(data);

    } catch (err: any) {
      console.error('Error loading suggestions:', err);
      setError(err.message || 'Error cargando sugerencias');
    } finally {
      setLoading(false);
    }
  };

  const handleOptimize = async () => {
    try {
      setOptimizing(true);
      setError(null);
      setSuccessMessage(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Sesión no válida');
        return;
      }

      const response = await fetch('/api/user/optimize-summary-schedule', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        throw new Error('Error optimizando horario');
      }

      const result = await response.json();

      if (result.success) {
        setSuccessMessage(result.message);
        // Recargar sugerencias para reflejar el cambio
        await loadSuggestions();

        // Recargar la página en 2 segundos para actualizar las preferencias
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        setError(result.message || 'No se pudo optimizar el horario');
      }

    } catch (err: any) {
      console.error('Error optimizing schedule:', err);
      setError(err.message || 'Error optimizando horario');
    } finally {
      setOptimizing(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        padding: 'var(--space-6)',
        borderRadius: 'var(--radius-lg)',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-primary)',
      }}>
        <p style={{ color: 'var(--text-secondary)' }}>Analizando tus patrones de uso...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: 'var(--space-6)',
        borderRadius: 'var(--radius-lg)',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-danger)',
      }}>
        <p style={{ color: 'var(--text-danger)' }}>{error}</p>
      </div>
    );
  }

  if (!suggestion) {
    return null;
  }

  if (!suggestion.hasEnoughData) {
    return (
      <div style={{
        padding: 'var(--space-6)',
        borderRadius: 'var(--radius-lg)',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-primary)',
      }}>
        <h3 style={{
          fontSize: 'var(--text-lg)',
          fontWeight: 'var(--font-semibold)',
          color: 'var(--text-primary)',
          marginBottom: 'var(--space-2)',
        }}>
          📊 Optimización Inteligente
        </h3>
        <p style={{
          color: 'var(--text-secondary)',
          marginBottom: 'var(--space-4)',
        }}>
          Se necesitan al menos 7 días de resúmenes con interacciones para analizar tus patrones.
        </p>
        <p style={{
          fontSize: 'var(--text-sm)',
          color: 'var(--text-tertiary)',
        }}>
          Datos actuales: {suggestion.dataPoints} resúmenes
        </p>
      </div>
    );
  }

  const improvementPercentage = Math.round(suggestion.suggestedSchedule.potentialImprovement);
  const isOptimal = !suggestion.shouldChange;

  return (
    <div style={{
      padding: 'var(--space-6)',
      borderRadius: 'var(--radius-lg)',
      backgroundColor: 'var(--bg-secondary)',
      border: `1px solid ${isOptimal ? 'var(--color-success)' : 'var(--border-primary)'}`,
    }}>
      {/* Header */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h3 style={{
          fontSize: 'var(--text-lg)',
          fontWeight: 'var(--font-semibold)',
          color: 'var(--text-primary)',
          marginBottom: 'var(--space-2)',
        }}>
          {isOptimal ? '✅ Horario Óptimo' : '⚡ Optimización Disponible'}
        </h3>
        <p style={{
          fontSize: 'var(--text-sm)',
          color: 'var(--text-secondary)',
        }}>
          {suggestion.recommendation}
        </p>
      </div>

      {/* Current vs Suggested */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 'var(--space-4)',
        marginBottom: 'var(--space-6)',
      }}>
        {/* Current Schedule */}
        <div style={{
          padding: 'var(--space-4)',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--bg-tertiary)',
        }}>
          <div style={{
            fontSize: 'var(--text-xs)',
            textTransform: 'uppercase',
            fontWeight: 'var(--font-medium)',
            color: 'var(--text-tertiary)',
            marginBottom: 'var(--space-2)',
          }}>
            Horario Actual
          </div>
          <div style={{
            fontSize: 'var(--text-2xl)',
            fontWeight: 'var(--font-bold)',
            color: 'var(--text-primary)',
            marginBottom: 'var(--space-1)',
          }}>
            {suggestion.currentSchedule.time.substring(0, 5)}
          </div>
          <div style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--text-secondary)',
          }}>
            CTR: {Math.round(suggestion.currentSchedule.ctr)}%
          </div>
        </div>

        {/* Suggested Schedule */}
        {!isOptimal && (
          <div style={{
            padding: 'var(--space-4)',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--bg-success)',
            border: '1px solid var(--color-success)',
          }}>
            <div style={{
              fontSize: 'var(--text-xs)',
              textTransform: 'uppercase',
              fontWeight: 'var(--font-medium)',
              color: 'var(--text-success)',
              marginBottom: 'var(--space-2)',
            }}>
              Horario Sugerido
            </div>
            <div style={{
              fontSize: 'var(--text-2xl)',
              fontWeight: 'var(--font-bold)',
              color: 'var(--text-primary)',
              marginBottom: 'var(--space-1)',
            }}>
              {suggestion.suggestedSchedule.time.substring(0, 5)}
            </div>
            <div style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--text-success)',
              fontWeight: 'var(--font-medium)',
            }}>
              CTR: {Math.round(suggestion.suggestedSchedule.ctr)}% (+{improvementPercentage}%)
            </div>
          </div>
        )}
      </div>

      {/* Insights */}
      {suggestion.insights && suggestion.insights.length > 0 && (
        <div style={{
          padding: 'var(--space-4)',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--bg-tertiary)',
          marginBottom: 'var(--space-6)',
        }}>
          <div style={{
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--font-medium)',
            color: 'var(--text-primary)',
            marginBottom: 'var(--space-3)',
          }}>
            💡 Insights
          </div>
          <ul style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
          }}>
            {suggestion.insights.map((insight, index) => (
              <li
                key={index}
                style={{
                  fontSize: 'var(--text-sm)',
                  color: 'var(--text-secondary)',
                  marginBottom: index < suggestion.insights.length - 1 ? 'var(--space-2)' : 0,
                  paddingLeft: 'var(--space-4)',
                  position: 'relative',
                }}
              >
                <span style={{
                  position: 'absolute',
                  left: 0,
                  color: 'var(--text-tertiary)',
                }}>
                  •
                </span>
                {insight}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Success Message */}
      {successMessage && (
        <div style={{
          padding: 'var(--space-4)',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--bg-success)',
          border: '1px solid var(--color-success)',
          marginBottom: 'var(--space-6)',
        }}>
          <p style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--text-success)',
            fontWeight: 'var(--font-medium)',
          }}>
            ✅ {successMessage}
          </p>
        </div>
      )}

      {/* Action Button */}
      {!isOptimal && (
        <button
          onClick={handleOptimize}
          disabled={optimizing}
          style={{
            width: '100%',
            padding: 'var(--space-3)',
            borderRadius: 'var(--radius-md)',
            backgroundColor: optimizing ? 'var(--bg-tertiary)' : 'var(--color-primary)',
            color: 'white',
            border: 'none',
            fontSize: 'var(--text-base)',
            fontWeight: 'var(--font-medium)',
            cursor: optimizing ? 'not-allowed' : 'pointer',
            opacity: optimizing ? 0.6 : 1,
            transition: 'all 0.2s',
          }}
        >
          {optimizing ? 'Optimizando...' : `⚡ Optimizar Horario (+${improvementPercentage}%)`}
        </button>
      )}

      {/* Data Points Info */}
      <div style={{
        marginTop: 'var(--space-4)',
        fontSize: 'var(--text-xs)',
        color: 'var(--text-tertiary)',
        textAlign: 'center',
      }}>
        Análisis basado en {suggestion.dataPoints} resúmenes con interacciones
      </div>
    </div>
  );
}
