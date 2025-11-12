'use client';

import { useState, useEffect } from 'react';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  RefreshIcon,
  SettingsIcon,
  SpinnerIcon,
} from '../Icons';
import { SummarySection } from './SummarySection';
import type { ParsedSummary } from '../DailySummaryPanel';

interface DesktopSummarySidebarProps {
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
  sidebarWidth: number;
  setSidebarWidth: (width: number) => void;
  parsedSummary: ParsedSummary;
  date: string;
  onRegenerate: () => void;
  onDismiss: () => void;
  onConfigure?: () => void;
  isLoading: boolean;
}

export function DesktopSummarySidebar({
  isExpanded,
  setIsExpanded,
  sidebarWidth,
  setSidebarWidth,
  parsedSummary,
  date,
  onRegenerate,
  onDismiss,
  onConfigure,
  isLoading,
}: DesktopSummarySidebarProps) {
  const [isResizing, setIsResizing] = useState(false);

  // Handle resize
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(250, Math.min(500, e.clientX));
      setSidebarWidth(newWidth);
      localStorage.setItem('summary_sidebar_width', newWidth.toString());
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, setSidebarWidth]);

  // Collapsed state - Icon only
  if (!isExpanded) {
    return (
      <div
        style={{
          width: 60,
          height: '100vh',
          backgroundColor: 'var(--bg-elevated)',
          borderRight: '1px solid var(--border-primary)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: 'var(--space-6)',
          gap: 'var(--space-4)',
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => setIsExpanded(true)}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            backgroundColor: 'var(--bg-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: 'var(--text-xl)',
            transition: 'all 0.2s ease',
          }}
          title="Abrir resumen"
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          📅
        </button>

        {/* Vertical text */}
        <div
          style={{
            writingMode: 'vertical-rl',
            transform: 'rotate(180deg)',
            fontSize: 'var(--text-xs)',
            fontWeight: 'var(--font-semibold)',
            color: 'var(--text-tertiary)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginTop: 'var(--space-4)',
          }}
        >
          Resumen
        </div>
      </div>
    );
  }

  // Expanded state - Full sidebar
  return (
    <div
      style={{
        width: sidebarWidth,
        height: '100vh',
        backgroundColor: 'var(--bg-elevated)',
        borderRight: '1px solid var(--border-primary)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        flexShrink: 0,
        transition: isResizing ? 'none' : 'width 0.2s ease',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: 'var(--space-4)',
          borderBottom: '1px solid var(--border-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span style={{ fontSize: 'var(--text-xl)' }}>📅</span>
          <div>
            <div
              style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--font-semibold)',
                color: 'var(--text-primary)',
              }}
            >
              Resumen del Día
            </div>
            <div
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--text-tertiary)',
              }}
            >
              {date}
            </div>
          </div>
        </div>

        <button
          onClick={() => setIsExpanded(false)}
          style={{
            width: '28px',
            height: '28px',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            backgroundColor: 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            transition: 'all 0.2s ease',
          }}
          title="Colapsar"
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <ChevronLeftIcon size={16} />
        </button>
      </div>

      {/* Content - Scrollable */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'var(--space-4)',
        }}
      >
        {/* Eventos */}
        {parsedSummary.eventos.length > 0 && (
          <SummarySection icon="📅" title="Eventos" items={parsedSummary.eventos} />
        )}

        {/* Tareas */}
        {parsedSummary.tareas.length > 0 && (
          <SummarySection icon="✅" title="Tareas" items={parsedSummary.tareas} />
        )}

        {/* Correos */}
        {parsedSummary.correos.length > 0 && (
          <SummarySection icon="📧" title="Correos" items={parsedSummary.correos} />
        )}

        {/* Tendencias */}
        {parsedSummary.tendencias && (
          <div style={{ marginTop: 'var(--space-4)' }}>
            <div
              style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--font-semibold)',
                color: 'var(--text-primary)',
                marginBottom: 'var(--space-2)',
              }}
            >
              📊 Tu Semana
            </div>
            <pre
              style={{
                whiteSpace: 'pre-wrap',
                fontSize: 'var(--text-xs)',
                color: 'var(--text-secondary)',
                margin: 0,
                lineHeight: 1.6,
                fontFamily: 'var(--font-display)',
              }}
            >
              {parsedSummary.tendencias}
            </pre>
          </div>
        )}

        {/* Si no hay nada parseado, mostrar el raw */}
        {parsedSummary.eventos.length === 0 &&
          parsedSummary.tareas.length === 0 &&
          parsedSummary.correos.length === 0 &&
          !parsedSummary.tendencias && (
            <pre
              style={{
                whiteSpace: 'pre-wrap',
                fontSize: 'var(--text-sm)',
                color: 'var(--text-secondary)',
                margin: 0,
                fontFamily: 'var(--font-display)',
                lineHeight: 'var(--leading-relaxed)',
              }}
            >
              {parsedSummary.raw}
            </pre>
          )}
      </div>

      {/* Footer - Actions */}
      <div
        style={{
          padding: 'var(--space-4)',
          borderTop: '1px solid var(--border-primary)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
          flexShrink: 0,
        }}
      >
        <button
          onClick={onRegenerate}
          disabled={isLoading}
          style={{
            padding: 'var(--space-2)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-primary)',
            backgroundColor: 'var(--bg-secondary)',
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--font-medium)',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.5 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--space-2)',
            color: 'var(--text-primary)',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            if (!isLoading) {
              e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
          }}
        >
          {isLoading ? <SpinnerIcon size={14} /> : <RefreshIcon size={14} />}
          {isLoading ? 'Regenerando...' : 'Regenerar'}
        </button>

        {onConfigure && (
          <button
            onClick={onConfigure}
            style={{
              padding: 'var(--space-2)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-primary)',
              backgroundColor: 'var(--bg-secondary)',
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--font-medium)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-2)',
              color: 'var(--text-primary)',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
            }}
          >
            <SettingsIcon size={14} />
            Configurar
          </button>
        )}
      </div>

      {/* Resize Handle */}
      <div
        onMouseDown={() => setIsResizing(true)}
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: '4px',
          cursor: 'col-resize',
          backgroundColor: isResizing ? 'var(--color-primary)' : 'transparent',
          transition: 'background-color 0.2s',
        }}
        onMouseEnter={(e) => {
          if (!isResizing) {
            e.currentTarget.style.backgroundColor = 'var(--border-primary)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isResizing) {
            e.currentTarget.style.backgroundColor = 'transparent';
          }
        }}
      />
    </div>
  );
}
