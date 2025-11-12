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
    ctr: number;
  };
  suggestedSchedule: {
    time: string;
    ctr: number;
    potentialImprovement: number;
  };
  shouldChange: boolean;
  recommendation: string;
  insights: string[];
}

export default function ScheduleOptimization() {
  const supabase = createSupabaseBrowserClient();
  const [loading, setLoading] = useState(true);
  const [suggestion, setSuggestion] = useState<ScheduleSuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [optimizing, setOptimizing] = useState(false);
  const [success, setSuccess] = useState(false);

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
        throw new Error('Error obteniendo sugerencias');
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

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Sesión no válida');
        return;
      }

      const response = await fetch('/api/user/optimize-summary-schedule', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Error optimizando horario');
      }

      const result = await response.json();

      // Recargar sugerencias
      await loadSuggestions();

      // Mostrar mensaje de éxito
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);

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
        <p style={{ color: 'var(--text-secondary)' }}>Analizando patrones de uso...</p>
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

  // No hay suficientes datos
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
          marginBottom: 'var(--space-4)',
          color: 'var(--text-primary)',
        }}>
          🎯 Optimización Inteligente de Horario
        </h3>
        <p style={{
          color: 'var(--text-secondary)',
          fontSize: 'var(--text-sm)',
          lineHeight: '1.6',
        }}>
          Se necesitan al menos 7 días de resúmenes con interacciones para generar sugerencias.
          <br />
          <span style={{ color: 'var(--text-tertiary)' }}>
            Actualmente: {suggestion.dataPoints} días de datos
          </span>
        </p>
      </div>
    );
  }

  // Horario ya óptimo
  if (!suggestion.shouldChange) {
    return (
      <div style={{
        padding: 'var(--space-6)',
        borderRadius: 'var(--radius-lg)',
        backgroundColor: 'var(--bg-success)',
        border: '1px solid var(--color-success)',
      }}>
        <h3 style={{
          fontSize: 'var(--text-lg)',
          fontWeight: 'var(--font-semibold)',
          marginBottom: 'var(--space-4)',
          color: 'var(--text-success)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
        }}>
          ✅ Horario Ya Óptimo
        </h3>
        <p style={{
          color: 'var(--text-primary)',
          fontSize: 'var(--text-sm)',
          lineHeight: '1.6',
        }}>
          {suggestion.recommendation}
        </p>
        {suggestion.insights && suggestion.insights.length > 0 && (
          <ul style={{
            marginTop: 'var(--space-4)',
            listStyle: 'none',
            padding: 0,
          }}>
            {suggestion.insights.map((insight, index) => (
              <li
                key={index}
                style={{
                  fontSize: 'var(--text-sm)',
                  color: 'var(--text-secondary)',
                  marginBottom: 'var(--space-2)',
                  paddingLeft: 'var(--space-4)',
                  position: 'relative',
                }}
              >
                <span style={{
                  position: 'absolute',
                  left: 0,
                  color: 'var(--color-success)',
                }}>
                  •
                </span>
                {insight}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  // Hay mejora disponible
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
        marginBottom: 'var(--space-4)',
        color: 'var(--text-primary)',
      }}>
        🎯 Optimización Inteligente de Horario
      </h3>

      {success && (
        <div style={{
          padding: 'var(--space-3)',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--bg-success)',
          border: '1px solid var(--color-success)',
          marginBottom: 'var(--space-4)',
        }}>
          <p style={{
            color: 'var(--text-success)',
            fontSize: 'var(--text-sm)',
            margin: 0,
          }}>
            ✅ Horario optimizado exitosamente
          </p>
        </div>
      )}

      <p style={{
        color: 'var(--text-secondary)',
        fontSize: 'var(--text-sm)',
        marginBottom: 'var(--space-6)',
        lineHeight: '1.6',
      }}>
        Basado en tus patrones de los últimos {suggestion.dataPoints} días, detectamos una oportunidad de mejora:
      </p>

      {/* Comparación lado a lado */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 'var(--space-4)',
        marginBottom: 'var(--space-6)',
      }}>
        {/* Horario Actual */}
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

        {/* Horario Sugerido */}
        <div style={{
          padding: 'var(--space-4)',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--bg-primary)',
          border: '2px solid var(--color-primary)',
        }}>
          <div style={{
            fontSize: 'var(--text-xs)',
            textTransform: 'uppercase',
            fontWeight: 'var(--font-medium)',
            color: 'var(--text-tertiary)',
            marginBottom: 'var(--space-2)',
          }}>
            Horario Sugerido
          </div>
          <div style={{
            fontSize: 'var(--text-2xl)',
            fontWeight: 'var(--font-bold)',
            color: 'var(--color-primary)',
            marginBottom: 'var(--space-1)',
          }}>
            {suggestion.suggestedSchedule.time.substring(0, 5)}
          </div>
          <div style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--text-secondary)',
            marginBottom: 'var(--space-1)',
          }}>
            CTR: {Math.round(suggestion.suggestedSchedule.ctr)}%
          </div>
          <div style={{
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--font-semibold)',
            color: 'var(--color-success)',
          }}>
            +{Math.round(suggestion.suggestedSchedule.potentialImprovement)}% mejora
          </div>
        </div>
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
                  color: 'var(--color-primary)',
                }}>
                  •
                </span>
                {insight}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Botón de Optimización */}
      <button
        onClick={handleOptimize}
        disabled={optimizing}
        style={{
          width: '100%',
          padding: 'var(--space-3) var(--space-4)',
          borderRadius: 'var(--radius-md)',
          border: 'none',
          backgroundColor: 'var(--color-primary)',
          color: 'white',
          fontSize: 'var(--text-sm)',
          fontWeight: 'var(--font-medium)',
          cursor: optimizing ? 'not-allowed' : 'pointer',
          opacity: optimizing ? 0.6 : 1,
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          if (!optimizing) {
            e.currentTarget.style.opacity = '0.9';
          }
        }}
        onMouseLeave={(e) => {
          if (!optimizing) {
            e.currentTarget.style.opacity = '1';
          }
        }}
      >
        {optimizing ? 'Optimizando...' : `Optimizar Horario (+${Math.round(suggestion.suggestedSchedule.potentialImprovement)}%)`}
      </button>
    </div>
  );
}
