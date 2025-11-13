# 🎨 Propuesta de Mejoras UX - Chat Interface

Este documento detalla las mejoras propuestas para la interfaz del chat, priorizadas por impacto y esfuerzo.

---

## 📊 PROBLEMA #0: Daily Summary Ocupa Demasiado Espacio

### 🔴 Problema Actual

**Ubicación:** `/app/page.tsx` líneas 609-643

**Issues:**
1. **Mobile:** Ocupa 60-80% de la pantalla visible (300-400px de altura)
2. **Desktop:** Empuja los mensajes hacia abajo innecesariamente
3. **No colapsable:** Usuario no puede minimizarlo si no lo necesita
4. **Bloqueante:** Dificulta acceder al chat rápidamente

**Impacto UX:**
- En mobile: Usuario tiene que hacer scroll para llegar al chat
- En desktop: Desperdicia espacio horizontal (el summary es vertical pero hay espacio lateral)
- Mala priorización visual: El summary compite con el chat por atención

---

### ✅ Solución Propuesta: Responsive Daily Summary

#### **A. Mobile (< 768px): Collapsible Card**

**Diseño:**

```
EXPANDED (altura variable ~300px):
┌──────────────────────────────────────────┐
│ 📅 Resumen del Día              [△]     │ ← Header (50px)
│ 12 de noviembre • 3 tareas              │
├──────────────────────────────────────────┤
│                                          │
│ 📅 Eventos de Hoy:                       │ ← Content (expandible)
│ • 09:00 - Reunión de equipo             │
│ • 14:00 - Presentación proyecto         │
│                                          │
│ ✅ Tareas Pendientes:                    │
│ • Revisar propuesta de cliente          │
│ • Responder correos urgentes            │
│                                          │
│ 📧 Correos Importantes:                  │
│ • Email de Juan sobre presupuesto       │
│                                          │
│ 📊 Tendencias de la Semana:              │
│ 85 interacciones (promedio: 12/día)     │
│ 🔥 Martes fue tu día más activo         │
│                                          │
│ ┌──────────┬───────────┬──────────┐     │ ← Actions (40px)
│ │ 🔄 Regen │ 📤 Share  │ × Cerrar │     │
│ └──────────┴───────────┴──────────┘     │
└──────────────────────────────────────────┘

COLLAPSED (solo header - 50px):
┌──────────────────────────────────────────┐
│ 📅 Resumen del Día              [▽]     │
│ 12 de noviembre • 3 tareas • Ver más    │
└──────────────────────────────────────────┘
```

**Características Mobile:**
- ✅ Estado inicial: **COLLAPSED** (solo header visible)
- ✅ Tap en header → Toggle expand/collapse con animación suave
- ✅ Swipe down → Collapse automático
- ✅ Badge con número de items (ej: "5 pendientes")
- ✅ Posición: Fijo en top del chat (sticky)
- ✅ Botón [× Cerrar] → Dismiss hasta mañana (guarda en localStorage)

---

#### **B. Desktop (≥ 768px): Sidebar Panel**

**Diseño:**

```
EXPANDED (sidebar 300-400px):
┌──────────────┬─────────────────────────────────────────────┐
│              │  🤖 Asistente Cloution        [⚙️]         │
│  📅 RESUMEN  │                                             │
│     DEL      │  ┌───────────────────────────────────────┐ │
│     DÍA      │  │ Usuario: ¿Qué tengo pendiente?       │ │
│              │  └───────────────────────────────────────┘ │
│ ┌──────────┐ │                                             │
│ │ 12 Nov   │ │  ┌───────────────────────────────────────┐ │
│ │ Miércoles│ │  │ AI: Tienes 3 tareas urgentes...      │ │
│ └──────────┘ │  └───────────────────────────────────────┘ │
│              │                                             │
│ 📅 Eventos   │  ┌───────────────────────────────────────┐ │
│ ─────────    │  │ Usuario: Ayúdame a priorizarlas      │ │
│ 09:00        │  └───────────────────────────────────────┘ │
│ Reunión con  │                                             │
│ equipo       │                                             │
│              │  [Input del chat aquí...]                  │
│ 14:00        │                                             │
│ Presentación │                                             │
│              │                                             │
│ ✅ Tareas    │                                             │
│ ─────────    │                                             │
│ • Revisar    │                                             │
│   propuesta  │                                             │
│ • Responder  │                                             │
│   correos    │                                             │
│              │                                             │
│ 📧 Correos   │                                             │
│ ─────────    │                                             │
│ Juan: Pres.  │                                             │
│ María: Docs  │                                             │
│              │                                             │
│ 📊 Semana    │                                             │
│ ─────────    │                                             │
│ 85 interact. │                                             │
│ Promedio:    │                                             │
│ 12/día       │                                             │
│              │                                             │
│ ┌──────────┐ │                                             │
│ │ 🔄 Regen │ │                                             │
│ └──────────┘ │                                             │
│ ┌──────────┐ │                                             │
│ │ ↗ Expand │ │                                             │
│ └──────────┘ │                                             │
│ ┌──────────┐ │                                             │
│ │ ⚙ Config │ │                                             │
│ └──────────┘ │                                             │
└──────────────┴─────────────────────────────────────────────┘

COLLAPSED (icono lateral - 60px):
┌─┬────────────────────────────────────────────────────┐
│📅│  🤖 Asistente Cloution        [⚙️]               │
│ │                                                    │
│R│  ┌─────────────────────────────────────────────┐  │
│E│  │ Usuario: ¿Qué tengo pendiente?             │  │
│S│  └─────────────────────────────────────────────┘  │
│U│                                                    │
│M│  ┌─────────────────────────────────────────────┐  │
│E│  │ AI: Tienes 3 tareas urgentes...            │  │
│N│  └─────────────────────────────────────────────┘  │
│ │                                                    │
│ │  [Input del chat aquí...]                         │
└─┴────────────────────────────────────────────────────┘
```

**Características Desktop:**
- ✅ Estado inicial: **EXPANDED** (sidebar visible)
- ✅ Click en [<] o icono → Collapse sidebar
- ✅ Hover en collapsed sidebar → Preview tooltip
- ✅ Drag border → Resize sidebar (min: 250px, max: 500px)
- ✅ Layout: Flex row con el chat ocupando el resto
- ✅ Botón [↗ Expand] → Abrir en modal full-screen con más detalles
- ✅ Botón [⚙ Config] → Configurar horario de resúmenes

---

### 🛠️ Implementación Técnica

#### **1. Nuevo Componente: `DailySummaryPanel.tsx`**

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { motion, AnimatePresence } from 'framer-motion';

interface DailySummaryPanelProps {
  summary: string;
  date: string;
  onRegenerate: () => void;
  onDismiss: () => void;
  isLoading?: boolean;
}

export default function DailySummaryPanel({
  summary,
  date,
  onRegenerate,
  onDismiss,
  isLoading = false
}: DailySummaryPanelProps) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [isExpanded, setIsExpanded] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(350);

  // Cargar estado guardado
  useEffect(() => {
    const savedState = localStorage.getItem('summary_expanded');
    const savedWidth = localStorage.getItem('summary_sidebar_width');

    if (savedState !== null) {
      setIsExpanded(JSON.parse(savedState));
    } else {
      // Default: mobile collapsed, desktop expanded
      setIsExpanded(!isMobile);
    }

    if (savedWidth) {
      setSidebarWidth(parseInt(savedWidth));
    }
  }, [isMobile]);

  // Guardar estado
  useEffect(() => {
    localStorage.setItem('summary_expanded', JSON.stringify(isExpanded));
  }, [isExpanded]);

  // Parsear el summary en secciones
  const parsedSummary = parseSummary(summary);

  if (isMobile) {
    return <MobileSummaryCard {...{ isExpanded, setIsExpanded, parsedSummary, date, onRegenerate, onDismiss, isLoading }} />;
  }

  return <DesktopSummarySidebar {...{ isExpanded, setIsExpanded, sidebarWidth, setSidebarWidth, parsedSummary, date, onRegenerate, onDismiss, isLoading }} />;
}

// Helper para parsear el summary en secciones estructuradas
function parseSummary(summary: string) {
  const sections = {
    eventos: [] as string[],
    tareas: [] as string[],
    correos: [] as string[],
    tendencias: '' as string
  };

  // Extraer eventos (líneas que contienen tiempo + descripción)
  const eventoMatches = summary.match(/\d{2}:\d{2}.*$/gm);
  if (eventoMatches) sections.eventos = eventoMatches;

  // Extraer tareas (líneas que empiezan con • o -)
  const tareaMatches = summary.match(/[•\-]\s+.+$/gm);
  if (tareaMatches) sections.tareas = tareaMatches.map(t => t.replace(/^[•\-]\s+/, ''));

  // Extraer correos (líneas que mencionan "email", "correo", "@")
  const correoMatches = summary.match(/.*(email|correo|@).*/gi);
  if (correoMatches) sections.correos = correoMatches;

  // Extraer tendencias (sección que empieza con 📊)
  const tendenciaMatch = summary.match(/📊[\s\S]*?(?=\n\n|$)/);
  if (tendenciaMatch) sections.tendencias = tendenciaMatch[0];

  return sections;
}
```

#### **2. Componente Mobile Card**

```typescript
function MobileSummaryCard({
  isExpanded,
  setIsExpanded,
  parsedSummary,
  date,
  onRegenerate,
  onDismiss,
  isLoading
}: any) {
  const totalItems =
    parsedSummary.eventos.length +
    parsedSummary.tareas.length +
    parsedSummary.correos.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        margin: 'var(--space-4)',
        borderRadius: 'var(--radius-lg)',
        backgroundColor: 'var(--bg-elevated)',
        border: '1px solid var(--border-primary)',
        boxShadow: 'var(--shadow-md)',
        overflow: 'hidden',
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
            <div style={{
              fontSize: 'var(--text-base)',
              fontWeight: 'var(--font-semibold)',
              color: 'var(--text-primary)'
            }}>
              Resumen del Día
            </div>
            <div style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--text-secondary)',
              marginTop: 'var(--space-1)'
            }}>
              {date} • {totalItems} {totalItems === 1 ? 'item' : 'items'}
            </div>
          </div>
        </div>

        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDownIcon size={20} color="var(--text-secondary)" />
        </motion.div>
      </button>

      {/* Content - Expandible */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              padding: 'var(--space-4)',
              paddingTop: 0,
              borderTop: '1px solid var(--border-primary)'
            }}>
              {/* Eventos */}
              {parsedSummary.eventos.length > 0 && (
                <SummarySection
                  icon="📅"
                  title="Eventos de Hoy"
                  items={parsedSummary.eventos}
                />
              )}

              {/* Tareas */}
              {parsedSummary.tareas.length > 0 && (
                <SummarySection
                  icon="✅"
                  title="Tareas Pendientes"
                  items={parsedSummary.tareas}
                />
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
                <div style={{ marginTop: 'var(--space-4)' }}>
                  <pre style={{
                    whiteSpace: 'pre-wrap',
                    fontSize: 'var(--text-sm)',
                    color: 'var(--text-secondary)',
                    margin: 0
                  }}>
                    {parsedSummary.tendencias}
                  </pre>
                </div>
              )}

              {/* Actions */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: 'var(--space-2)',
                marginTop: 'var(--space-4)'
              }}>
                <button
                  onClick={onRegenerate}
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
                  }}
                >
                  {isLoading ? '...' : '🔄 Regen'}
                </button>

                <button
                  onClick={() => navigator.share({ text: parsedSummary })}
                  style={{
                    padding: 'var(--space-2)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-primary)',
                    backgroundColor: 'var(--bg-secondary)',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 'var(--font-medium)',
                    cursor: 'pointer',
                  }}
                >
                  📤 Share
                </button>

                <button
                  onClick={() => {
                    setIsExpanded(false);
                    onDismiss();
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
                  }}
                >
                  × Cerrar
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function SummarySection({ icon, title, items }: { icon: string; title: string; items: string[] }) {
  return (
    <div style={{ marginBottom: 'var(--space-4)' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        marginBottom: 'var(--space-2)',
        fontSize: 'var(--text-sm)',
        fontWeight: 'var(--font-semibold)',
        color: 'var(--text-primary)'
      }}>
        <span>{icon}</span>
        <span>{title}</span>
      </div>
      <ul style={{
        listStyle: 'none',
        padding: 0,
        margin: 0,
        fontSize: 'var(--text-sm)',
        color: 'var(--text-secondary)',
      }}>
        {items.map((item, index) => (
          <li key={index} style={{
            marginBottom: 'var(--space-1)',
            paddingLeft: 'var(--space-4)',
            position: 'relative'
          }}>
            <span style={{
              position: 'absolute',
              left: 0,
              color: 'var(--color-primary)'
            }}>•</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

#### **3. Componente Desktop Sidebar**

```typescript
function DesktopSummarySidebar({
  isExpanded,
  setIsExpanded,
  sidebarWidth,
  setSidebarWidth,
  parsedSummary,
  date,
  onRegenerate,
  onDismiss,
  isLoading
}: any) {
  const [isResizing, setIsResizing] = useState(false);

  const handleResize = (e: MouseEvent) => {
    if (isResizing) {
      const newWidth = Math.max(250, Math.min(500, e.clientX));
      setSidebarWidth(newWidth);
      localStorage.setItem('summary_sidebar_width', newWidth.toString());
    }
  };

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleResize);
      window.addEventListener('mouseup', () => setIsResizing(false));
      return () => {
        window.removeEventListener('mousemove', handleResize);
        window.removeEventListener('mouseup', () => setIsResizing(false));
      };
    }
  }, [isResizing]);

  if (!isExpanded) {
    // Collapsed state - Icon only
    return (
      <motion.div
        initial={{ width: 60 }}
        animate={{ width: 60 }}
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
          }}
          title="Abrir resumen"
        >
          📅
        </button>

        {/* Vertical text */}
        <div style={{
          writingMode: 'vertical-rl',
          transform: 'rotate(180deg)',
          fontSize: 'var(--text-xs)',
          fontWeight: 'var(--font-semibold)',
          color: 'var(--text-tertiary)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}>
          Resumen
        </div>
      </motion.div>
    );
  }

  // Expanded state - Full sidebar
  return (
    <motion.div
      initial={{ width: sidebarWidth }}
      animate={{ width: sidebarWidth }}
      style={{
        width: sidebarWidth,
        height: '100vh',
        backgroundColor: 'var(--bg-elevated)',
        borderRight: '1px solid var(--border-primary)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      {/* Header */}
      <div style={{
        padding: 'var(--space-4)',
        borderBottom: '1px solid var(--border-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span style={{ fontSize: 'var(--text-xl)' }}>📅</span>
          <div>
            <div style={{
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--font-semibold)',
              color: 'var(--text-primary)'
            }}>
              Resumen del Día
            </div>
            <div style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--text-tertiary)'
            }}>
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
          }}
          title="Colapsar"
        >
          <ChevronLeftIcon size={16} />
        </button>
      </div>

      {/* Content - Scrollable */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: 'var(--space-4)',
      }}>
        {/* Same sections as mobile */}
        {parsedSummary.eventos.length > 0 && (
          <SummarySection
            icon="📅"
            title="Eventos"
            items={parsedSummary.eventos}
          />
        )}

        {parsedSummary.tareas.length > 0 && (
          <SummarySection
            icon="✅"
            title="Tareas"
            items={parsedSummary.tareas}
          />
        )}

        {parsedSummary.correos.length > 0 && (
          <SummarySection
            icon="📧"
            title="Correos"
            items={parsedSummary.correos}
          />
        )}

        {parsedSummary.tendencias && (
          <div style={{ marginTop: 'var(--space-4)' }}>
            <div style={{
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--font-semibold)',
              color: 'var(--text-primary)',
              marginBottom: 'var(--space-2)'
            }}>
              📊 Tu Semana
            </div>
            <pre style={{
              whiteSpace: 'pre-wrap',
              fontSize: 'var(--text-xs)',
              color: 'var(--text-secondary)',
              margin: 0,
              lineHeight: 1.6
            }}>
              {parsedSummary.tendencias}
            </pre>
          </div>
        )}
      </div>

      {/* Footer - Actions */}
      <div style={{
        padding: 'var(--space-4)',
        borderTop: '1px solid var(--border-primary)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
      }}>
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
          }}
        >
          {isLoading ? <SpinnerIcon size={14} /> : '🔄'}
          {isLoading ? 'Regenerando...' : 'Regenerar'}
        </button>

        <button
          onClick={() => {/* Open full-screen modal */}}
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
          }}
        >
          ↗ Expandir
        </button>

        <button
          onClick={() => {/* Go to settings */}}
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
          }}
        >
          ⚙ Configurar
        </button>
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
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--border-primary)'}
        onMouseLeave={(e) => {
          if (!isResizing) e.currentTarget.style.backgroundColor = 'transparent';
        }}
      />
    </motion.div>
  );
}
```

#### **4. Hook Personalizado: `useMediaQuery`**

```typescript
// hooks/useMediaQuery.ts
import { useState, useEffect } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);

    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addEventListener('change', listener);

    return () => media.removeEventListener('change', listener);
  }, [query]);

  return matches;
}
```

#### **5. Integración en `/app/page.tsx`**

```typescript
// ANTES (líneas 609-643): Reemplazar con el nuevo componente

import DailySummaryPanel from '@/components/DailySummaryPanel';

// ...

{dailySummary && (
  <DailySummaryPanel
    summary={dailySummary}
    date={summaryDate || new Date().toLocaleDateString('es-ES')}
    onRegenerate={async () => {
      setDailySummaryLoading(true);
      await loadDailySummary();
      setDailySummaryLoading(false);
    }}
    onDismiss={() => {
      setDailySummary(null);
      localStorage.setItem('summary_dismissed_date', new Date().toISOString());
    }}
    isLoading={dailySummaryLoading}
  />
)}
```

#### **6. Actualizar Layout para Desktop**

```typescript
// El layout principal debe cambiar a flex row en desktop
<div style={{
  display: 'flex',
  height: '100vh',
  width: '100vw',
}}>
  {/* Daily Summary Sidebar (solo desktop) */}
  {!isMobile && dailySummary && (
    <DailySummaryPanel {...props} />
  )}

  {/* Chat Content */}
  <div style={{
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  }}>
    {/* Daily Summary Card (solo mobile) */}
    {isMobile && dailySummary && (
      <DailySummaryPanel {...props} />
    )}

    {/* Header */}
    {/* Messages */}
    {/* Input */}
  </div>
</div>
```

---

### 📊 Comparación Antes/Después

| Aspecto | Antes | Después |
|---------|-------|---------|
| **Mobile - Espacio ocupado** | 300-400px (60-80% pantalla) | 50px collapsed (5-10% pantalla) |
| **Desktop - Layout** | Vertical, empuja mensajes | Sidebar lateral, no afecta chat |
| **Accesibilidad al chat** | 2-3 scrolls para llegar | 0 scrolls (inmediato) |
| **Control del usuario** | Sin opciones | Collapse/expand, resize, dismiss |
| **Persistencia del estado** | No | Sí (localStorage) |
| **Regenerar resumen** | No disponible | Botón dedicado |
| **Compartir resumen** | Copy manual | Botón Share nativo |
| **Configuración** | Ir a /settings | Acceso directo desde sidebar |

---

### ✅ Beneficios de la Solución

#### Mobile:
1. **+70% más espacio** para el chat al cargar
2. **Acceso inmediato** al input (no scroll)
3. **Control total** sobre cuándo ver el resumen
4. **Sticky header** con preview del contenido

#### Desktop:
5. **Uso inteligente del espacio horizontal** (sidebar vs vertical)
6. **No interfiere** con el flujo del chat
7. **Resize dinámico** para preferencias personales
8. **Multitasking**: Ver resumen Y chatear simultáneamente

#### Ambos:
9. **Persistencia de preferencias** (collapsed/expanded, width)
10. **Acciones rápidas** (regenerar, compartir, configurar)
11. **Mejora visual** con animaciones suaves
12. **Parser inteligente** que estructura el contenido en secciones

---

### 🚀 Plan de Implementación

#### Fase 1: Base (2-3 horas)
- [ ] Crear componente `DailySummaryPanel.tsx`
- [ ] Hook `useMediaQuery`
- [ ] Parser de secciones (`parseSummary`)
- [ ] Estilos base

#### Fase 2: Mobile (2-3 horas)
- [ ] Componente `MobileSummaryCard`
- [ ] Animaciones de expand/collapse
- [ ] Acciones (regenerar, share, dismiss)
- [ ] Persistencia de estado

#### Fase 3: Desktop (3-4 horas)
- [ ] Componente `DesktopSummarySidebar`
- [ ] Resize handle con drag
- [ ] Collapsed state (icono vertical)
- [ ] Layout flex ajustado en `page.tsx`

#### Fase 4: Polish (1-2 horas)
- [ ] Loading states
- [ ] Error handling
- [ ] Hover tooltips
- [ ] Keyboard shortcuts (Esc para collapse)
- [ ] Accessibility (ARIA labels, focus management)

**Total estimado: 8-12 horas**

---

### 🎯 Prioridad

**ALTA** - Esta mejora es crítica porque:
1. Afecta la primera impresión del usuario (mobile UX)
2. Desperdicio de espacio en desktop
3. Impacto inmediato y visible
4. Soluciona un pain point real reportado por el usuario

---

## 📋 Otras Mejoras Críticas (Ver análisis completo)

1. Sistema de estados de mensaje (sending/sent/failed)
2. Smart auto-scroll + botón "scroll to bottom"
3. Manejo específico de errores + Toast notifications
4. Persistencia de mensajes (localStorage/Supabase)
5. Connection status indicator

---

**Próximo paso**: ¿Implementamos el Daily Summary responsive o prefieres empezar con otra mejora del chat?
