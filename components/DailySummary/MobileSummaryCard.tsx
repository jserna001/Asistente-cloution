'use client';

import { ChevronDownIcon, RefreshIcon, ShareIcon, XIcon } from '../Icons';
import { SummarySection } from './SummarySection';
import type { ParsedSummary } from '../DailySummaryPanel';

interface MobileSummaryCardProps {
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
  parsedSummary: ParsedSummary;
  date: string;
  onRegenerate: () => void;
  onDismiss: () => void;
  isLoading: boolean;
}

export function MobileSummaryCard({
  isExpanded,
  setIsExpanded,
  parsedSummary,
  date,
  onRegenerate,
  onDismiss,
  isLoading
}: MobileSummaryCardProps) {
  const totalItems =
    parsedSummary.eventos.length +
    parsedSummary.tareas.length +
    parsedSummary.correos.length;

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Resumen del Día',
          text: parsedSummary.raw
        });
      } catch (err) {
        // User cancelled or error
        console.log('Share cancelled or failed:', err);
      }
    } else {
      // Fallback: copiar al clipboard
      navigator.clipboard.writeText(parsedSummary.raw);
      alert('Resumen copiado al portapapeles');
    }
  };

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        margin: 'var(--space-4)',
        borderRadius: 'var(--radius-lg)',
        backgroundColor: 'var(--bg-elevated)',
        border: '1px solid var(--border-primary)',
        boxShadow: isExpanded ? 'var(--shadow-lg)' : 'var(--shadow-md)',
        overflow: 'hidden',
        transition: 'all 0.3s ease',
      }}
    >
      {/* Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          width: '100%',
          padding: 'var(--space-4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <span style={{ fontSize: 'var(--text-xl)' }}>📅</span>
          <div>
            <div
              style={{
                fontSize: 'var(--text-base)',
                fontWeight: 'var(--font-semibold)',
                color: 'var(--text-primary)',
              }}
            >
              Resumen del Día
            </div>
            <div
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--text-secondary)',
                marginTop: 'var(--space-1)',
              }}
            >
              {date} • {totalItems} {totalItems === 1 ? 'item' : 'items'}
            </div>
          </div>
        </div>

        <div
          style={{
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <ChevronDownIcon size={20} color="var(--text-secondary)" />
        </div>
      </button>

      {/* Content - Expandible */}
      {isExpanded && (
        <div
          style={{
            maxHeight: '60vh',
            overflowY: 'auto',
            animation: 'slideDown 0.3s ease-out',
          }}
        >
          <div
            style={{
              padding: 'var(--space-4)',
              paddingTop: 0,
              borderTop: '1px solid var(--border-primary)',
            }}
          >
            {/* Eventos */}
            {parsedSummary.eventos.length > 0 && (
              <SummarySection icon="📅" title="Eventos de Hoy" items={parsedSummary.eventos} />
            )}

            {/* Tareas */}
            {parsedSummary.tareas.length > 0 && (
              <SummarySection icon="✅" title="Tareas Pendientes" items={parsedSummary.tareas} />
            )}

            {/* Correos */}
            {parsedSummary.correos.length > 0 && (
              <SummarySection
                icon="📧"
                title="Correos Importantes"
                items={parsedSummary.correos}
              />
            )}

            {/* Tendencias */}
            {parsedSummary.tendencias && (
              <div style={{ marginTop: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
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
                    margin: 'var(--space-4) 0',
                    fontFamily: 'var(--font-display)',
                    lineHeight: 'var(--leading-relaxed)',
                  }}
                >
                  {parsedSummary.raw}
                </pre>
              )}

            {/* Actions */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: 'var(--space-2)',
                marginTop: 'var(--space-4)',
              }}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRegenerate();
                }}
                disabled={isLoading}
                style={{
                  padding: 'var(--space-2)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-primary)',
                  backgroundColor: 'var(--bg-secondary)',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 'var(--font-medium)',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  opacity: isLoading ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 'var(--space-1)',
                  color: 'var(--text-primary)',
                  transition: 'all 0.2s ease',
                }}
                onMouseDown={(e) => {
                  if (!isLoading) {
                    e.currentTarget.style.transform = 'scale(0.95)';
                  }
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                {isLoading ? (
                  '...'
                ) : (
                  <>
                    <RefreshIcon size={12} />
                    Regen
                  </>
                )}
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleShare();
                }}
                style={{
                  padding: 'var(--space-2)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-primary)',
                  backgroundColor: 'var(--bg-secondary)',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 'var(--font-medium)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 'var(--space-1)',
                  color: 'var(--text-primary)',
                  transition: 'all 0.2s ease',
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.transform = 'scale(0.95)';
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                <ShareIcon size={12} />
                Share
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(false);
                  setTimeout(() => onDismiss(), 300);
                }}
                style={{
                  padding: 'var(--space-2)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-danger)',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--color-danger)',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 'var(--font-medium)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 'var(--space-1)',
                  transition: 'all 0.2s ease',
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.transform = 'scale(0.95)';
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                <XIcon size={12} />
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slideDown {
          from {
            max-height: 0;
            opacity: 0;
          }
          to {
            max-height: 60vh;
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
