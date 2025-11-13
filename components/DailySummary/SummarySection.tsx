/**
 * Componente reutilizable para mostrar secciones del resumen
 * Usado tanto en mobile como en desktop
 */

interface SummarySectionProps {
  icon: string;
  title: string;
  items: string[];
}

export function SummarySection({ icon, title, items }: SummarySectionProps) {
  if (items.length === 0) return null;

  return (
    <div style={{ marginBottom: 'var(--space-4)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          marginBottom: 'var(--space-2)',
          fontSize: 'var(--text-sm)',
          fontWeight: 'var(--font-semibold)',
          color: 'var(--text-primary)',
        }}
      >
        <span>{icon}</span>
        <span>{title}</span>
      </div>
      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          fontSize: 'var(--text-sm)',
          color: 'var(--text-secondary)',
        }}
      >
        {items.map((item, index) => (
          <li
            key={index}
            style={{
              marginBottom: 'var(--space-2)',
              paddingLeft: 'var(--space-4)',
              position: 'relative',
              lineHeight: 'var(--leading-relaxed)',
            }}
          >
            <span
              style={{
                position: 'absolute',
                left: 0,
                color: 'var(--color-primary)',
              }}
            >
              •
            </span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
