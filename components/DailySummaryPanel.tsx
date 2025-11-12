'use client';

import { useState, useEffect } from 'react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { MobileSummaryCard } from './DailySummary/MobileSummaryCard';
import { DesktopSummarySidebar } from './DailySummary/DesktopSummarySidebar';

/**
 * DAILY SUMMARY PANEL - Componente Responsive
 *
 * Mobile (<768px): Collapsible card en top del chat
 * Desktop (≥768px): Sidebar lateral resizable
 *
 * Features:
 * - Parser inteligente de secciones (eventos, tareas, correos, tendencias)
 * - Persistencia de estado (collapsed/expanded, sidebar width)
 * - Acciones: Regenerar, Compartir, Dismiss, Configurar
 */

export interface ParsedSummary {
  eventos: string[];
  tareas: string[];
  correos: string[];
  tendencias: string;
  raw: string;
}

export interface DailySummaryPanelProps {
  summary: string;
  date: string;
  onRegenerate: () => void;
  onDismiss: () => void;
  onConfigure?: () => void;
  isLoading?: boolean;
}

export default function DailySummaryPanel({
  summary,
  date,
  onRegenerate,
  onDismiss,
  onConfigure,
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

  // Guardar estado cuando cambia
  useEffect(() => {
    localStorage.setItem('summary_expanded', JSON.stringify(isExpanded));
  }, [isExpanded]);

  // Parsear el summary en secciones estructuradas
  const parsedSummary = parseSummary(summary);

  // Renderizar versión mobile o desktop
  if (isMobile) {
    return (
      <MobileSummaryCard
        isExpanded={isExpanded}
        setIsExpanded={setIsExpanded}
        parsedSummary={parsedSummary}
        date={date}
        onRegenerate={onRegenerate}
        onDismiss={onDismiss}
        isLoading={isLoading}
      />
    );
  }

  return (
    <DesktopSummarySidebar
      isExpanded={isExpanded}
      setIsExpanded={setIsExpanded}
      sidebarWidth={sidebarWidth}
      setSidebarWidth={setSidebarWidth}
      parsedSummary={parsedSummary}
      date={date}
      onRegenerate={onRegenerate}
      onDismiss={onDismiss}
      onConfigure={onConfigure}
      isLoading={isLoading}
    />
  );
}

/**
 * Parser inteligente del summary text
 *
 * Extrae secciones estructuradas:
 * - Eventos: Líneas con formato de hora (09:00)
 * - Tareas: Líneas que empiezan con • o -
 * - Correos: Líneas que mencionan email/correo/@
 * - Tendencias: Sección que empieza con 📊
 */
function parseSummary(summary: string): ParsedSummary {
  const sections: ParsedSummary = {
    eventos: [],
    tareas: [],
    correos: [],
    tendencias: '',
    raw: summary
  };

  // Dividir en líneas para procesamiento
  const lines = summary.split('\n');

  // Extraer eventos (líneas que contienen tiempo HH:MM)
  const timePattern = /\d{1,2}:\d{2}/;
  sections.eventos = lines.filter(line => timePattern.test(line));

  // Extraer tareas (líneas que empiezan con • o - y no son de tiempo)
  const taskPattern = /^[•\-]\s+/;
  sections.tareas = lines
    .filter(line => taskPattern.test(line.trim()) && !timePattern.test(line))
    .map(line => line.trim().replace(taskPattern, ''));

  // Extraer correos (líneas que mencionan email, correo, @ o tienen "de:")
  const emailPattern = /(email|correo|@|de:)/i;
  sections.correos = lines.filter(line =>
    emailPattern.test(line) &&
    !timePattern.test(line) &&
    !taskPattern.test(line.trim())
  );

  // Extraer tendencias (sección que empieza con 📊 o "Tendencias")
  const trendStartIndex = lines.findIndex(line =>
    line.includes('📊') || line.toLowerCase().includes('tendencias')
  );

  if (trendStartIndex !== -1) {
    // Tomar desde esa línea hasta el final o hasta una línea vacía doble
    const trendLines = [];
    for (let i = trendStartIndex; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === '' && lines[i + 1]?.trim() === '') break;
      trendLines.push(line);
    }
    sections.tendencias = trendLines.join('\n');
  }

  return sections;
}
