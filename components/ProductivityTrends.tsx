'use client';

import { useState, useEffect } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabaseClient';

/**
 * FASE 4: Componente de Análisis de Tendencias
 *
 * Muestra tendencias de productividad con gráficos y insights automáticos.
 *
 * Uso:
 * import ProductivityTrends from '@/components/ProductivityTrends';
 * <ProductivityTrends period="week" />
 */

interface TrendData {
  period: 'week' | 'month';
  totalTasks: number;
  completedTasks: number;
  urgentTasks: number;
  completionRate: number;
  vsLastPeriod: {
    tasksChange: number;
    completionRateChange: number;
  };
  mostProductiveDay: {
    day: string;
    date: string;
    taskCount: number;
  };
  busiestHours: Array<{ hour: string; taskCount: number }>;
  dailyBreakdown: Array<{
    dayOfWeek: string;
    date: string;
    taskCount: number;
    urgentCount: number;
  }>;
  insights: string[];
}

interface ProductivityTrendsProps {
  period?: 'week' | 'month';
}

export default function ProductivityTrends({ period = 'week' }: ProductivityTrendsProps) {
  const supabase = createSupabaseBrowserClient();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<TrendData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month'>(period);

  useEffect(() => {
    loadTrends();
  }, [selectedPeriod]);

  const loadTrends = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Sesión no válida');
        return;
      }

      const response = await fetch(`/api/analytics/productivity-trends?period=${selectedPeriod}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        throw new Error('Error cargando tendencias');
      }

      const result = await response.json();
      setData(result.analysis);

    } catch (err: any) {
      console.error('Error loading trends:', err);
      setError(err.message || 'Error cargando tendencias');
    } finally {
      setLoading(false);
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
        <p style={{ color: 'var(--text-secondary)' }}>Analizando tu productividad...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{
        padding: 'var(--space-6)',
        borderRadius: 'var(--radius-lg)',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-danger)',
      }}>
        <p style={{ color: 'var(--text-danger)' }}>
          {error || 'No hay datos disponibles'}
        </p>
      </div>
    );
  }

  const maxTasks = Math.max(...data.dailyBreakdown.map(d => d.taskCount), 1);

  return (
    <div style={{
      padding: 'var(--space-6)',
      borderRadius: 'var(--radius-lg)',
      backgroundColor: 'var(--bg-secondary)',
      border: '1px solid var(--border-primary)',
    }}>
      {/* Header con selector de período */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 'var(--space-6)',
      }}>
        <h3 style={{
          fontSize: 'var(--text-lg)',
          fontWeight: 'var(--font-semibold)',
          color: 'var(--text-primary)',
        }}>
          📊 Análisis de Productividad
        </h3>

        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button
            onClick={() => setSelectedPeriod('week')}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              backgroundColor: selectedPeriod === 'week' ? 'var(--color-primary)' : 'var(--bg-tertiary)',
              color: selectedPeriod === 'week' ? 'white' : 'var(--text-secondary)',
              fontSize: 'var(--text-sm)',
              cursor: 'pointer',
            }}
          >
            Semana
          </button>
          <button
            onClick={() => setSelectedPeriod('month')}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              backgroundColor: selectedPeriod === 'month' ? 'var(--color-primary)' : 'var(--bg-tertiary)',
              color: selectedPeriod === 'month' ? 'white' : 'var(--text-secondary)',
              fontSize: 'var(--text-sm)',
              cursor: 'pointer',
            }}
          >
            Mes
          </button>
        </div>
      </div>

      {/* Estadísticas Principales */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: 'var(--space-4)',
        marginBottom: 'var(--space-6)',
      }}>
        {/* Total Tareas */}
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
            Total Tareas
          </div>
          <div style={{
            fontSize: 'var(--text-2xl)',
            fontWeight: 'var(--font-bold)',
            color: 'var(--text-primary)',
            marginBottom: 'var(--space-1)',
          }}>
            {data.totalTasks}
          </div>
          {data.vsLastPeriod.tasksChange !== 0 && (
            <div style={{
              fontSize: 'var(--text-sm)',
              color: data.vsLastPeriod.tasksChange > 0 ? 'var(--color-success)' : 'var(--color-danger)',
              fontWeight: 'var(--font-medium)',
            }}>
              {data.vsLastPeriod.tasksChange > 0 ? '+' : ''}
              {Math.round(data.vsLastPeriod.tasksChange)}% vs anterior
            </div>
          )}
        </div>

        {/* Tasa de Completación */}
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
            Completadas
          </div>
          <div style={{
            fontSize: 'var(--text-2xl)',
            fontWeight: 'var(--font-bold)',
            color: 'var(--text-primary)',
            marginBottom: 'var(--space-1)',
          }}>
            {Math.round(data.completionRate)}%
          </div>
          <div style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--text-secondary)',
          }}>
            {data.completedTasks} de {data.totalTasks}
          </div>
        </div>

        {/* Tareas Urgentes */}
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
            Urgentes
          </div>
          <div style={{
            fontSize: 'var(--text-2xl)',
            fontWeight: 'var(--font-bold)',
            color: 'var(--color-danger)',
            marginBottom: 'var(--space-1)',
          }}>
            {data.urgentTasks}
          </div>
          <div style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--text-secondary)',
          }}>
            {data.totalTasks > 0 ? Math.round((data.urgentTasks / data.totalTasks) * 100) : 0}% del total
          </div>
        </div>
      </div>

      {/* Gráfico de Barras - Actividad Diaria */}
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
          marginBottom: 'var(--space-4)',
        }}>
          Actividad Diaria
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 'var(--space-2)',
          height: '150px',
        }}>
          {data.dailyBreakdown.map((day, index) => (
            <div
              key={index}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 'var(--space-2)',
              }}
            >
              {/* Barra */}
              <div
                style={{
                  width: '100%',
                  height: `${(day.taskCount / maxTasks) * 120}px`,
                  backgroundColor: day.taskCount === data.mostProductiveDay.taskCount
                    ? 'var(--color-primary)'
                    : 'var(--color-primary)',
                  opacity: day.taskCount === data.mostProductiveDay.taskCount ? 1 : 0.5,
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'center',
                  paddingTop: 'var(--space-1)',
                  fontSize: 'var(--text-xs)',
                  color: 'white',
                  fontWeight: 'var(--font-medium)',
                }}
              >
                {day.taskCount > 0 ? day.taskCount : ''}
              </div>
              {/* Etiqueta */}
              <div style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--text-tertiary)',
                textAlign: 'center',
              }}>
                {day.dayOfWeek.substring(0, 3)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Día Más Productivo y Mejores Horas */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 'var(--space-4)',
        marginBottom: 'var(--space-6)',
      }}>
        {/* Día más productivo */}
        <div style={{
          padding: 'var(--space-4)',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--bg-tertiary)',
        }}>
          <div style={{
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--font-medium)',
            color: 'var(--text-primary)',
            marginBottom: 'var(--space-3)',
          }}>
            🔥 Día Más Productivo
          </div>
          <div style={{
            fontSize: 'var(--text-xl)',
            fontWeight: 'var(--font-bold)',
            color: 'var(--color-primary)',
            marginBottom: 'var(--space-1)',
          }}>
            {data.mostProductiveDay.day}
          </div>
          <div style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--text-secondary)',
          }}>
            {data.mostProductiveDay.taskCount} tareas completadas
          </div>
        </div>

        {/* Mejores horas */}
        <div style={{
          padding: 'var(--space-4)',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--bg-tertiary)',
        }}>
          <div style={{
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--font-medium)',
            color: 'var(--text-primary)',
            marginBottom: 'var(--space-3)',
          }}>
            ⏰ Mejores Horarios
          </div>
          {data.busiestHours.slice(0, 3).map((hour, index) => (
            <div
              key={index}
              style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--text-secondary)',
                marginBottom: 'var(--space-1)',
              }}
            >
              {index + 1}. {hour.hour} ({hour.taskCount} interacciones)
            </div>
          ))}
        </div>
      </div>

      {/* Insights Automáticos */}
      {data.insights && data.insights.length > 0 && (
        <div style={{
          padding: 'var(--space-4)',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--bg-success)',
          border: '1px solid var(--color-success)',
        }}>
          <div style={{
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--font-medium)',
            color: 'var(--text-success)',
            marginBottom: 'var(--space-3)',
          }}>
            💡 Insights
          </div>
          <ul style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
          }}>
            {data.insights.map((insight, index) => (
              <li
                key={index}
                style={{
                  fontSize: 'var(--text-sm)',
                  color: 'var(--text-primary)',
                  marginBottom: index < data.insights.length - 1 ? 'var(--space-2)' : 0,
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
        </div>
      )}
    </div>
  );
}
