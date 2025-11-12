'use client';

import { Suspense, useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '../lib/supabaseClient';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import {
  BotIcon,
  ZapIcon,
  BrainIcon,
  CopyIcon,
  CheckIcon,
  SettingsIcon,
  LogOutIcon,
  CalendarIcon,
  SendIcon,
  SpinnerIcon,
  AnimatedIcon,
  ModelBadge,
} from '../components/Icons';
import { AnimatedMessage } from '../components/AnimatedMessage';
import { TypingIndicator } from '../components/TypingIndicator';

gsap.registerPlugin(useGSAP);

// Tipos de mensajes mejorados
interface MessageMetadata {
  modelUsed?: string;
  taskType?: string;
  executionTimeMs?: number;
}

interface QuickAction {
  label: string;
  icon: string;
  action: string;
}

interface Message {
  sender: 'user' | 'ai';
  text: string;
  metadata?: MessageMetadata;
  timestamp: number;
  quickActions?: QuickAction[];
}

// Componente de Botón Copiar
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="icon-click-bounce"
      style={{
        padding: 'var(--space-1) var(--space-2)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-primary)',
        backgroundColor: 'transparent',
        color: 'var(--text-secondary)',
        fontSize: 'var(--text-xs)',
        cursor: 'pointer',
        transition: 'all var(--transition-fast)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-1)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
        e.currentTarget.style.color = 'var(--text-primary)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
        e.currentTarget.style.color = 'var(--text-secondary)';
      }}
    >
      {copied ? (
        <>
          <span className="icon-success-pulse" style={{ display: 'flex' }}>
            <CheckIcon size={14} />
          </span>
          Copiado
        </>
      ) : (
        <>
          <span className="icon-hover-scale" style={{ display: 'flex' }}>
            <CopyIcon size={14} />
          </span>
          Copiar
        </>
      )}
    </button>
  );
}

import Loader from '../components/Loader';
import OnboardingWizard from '../components/onboarding/OnboardingWizard';
import '../components/onboarding/OnboardingWizard.css';
import DailySummaryPanel from '../components/DailySummaryPanel';
import { useMediaQuery } from '../hooks/useMediaQuery';

function ChatUI() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentQuery, setCurrentQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [authStatus, setAuthStatus] = useState<string | null>(null);
  const [dailySummary, setDailySummary] = useState<string | null>(null);
  const [summaryDate, setSummaryDate] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Estados para onboarding
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);

  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  // Media query para responsive
  const isMobile = useMediaQuery('(max-width: 768px)');

  // Refs para animaciones GSAP
  const headerRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Cargar resumen diario
  async function loadDailySummary() {
    console.log('Cargando resumen diario...');

    const { data, error } = await supabase
      .from('daily_summaries')
      .select('summary_text, created_at')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error cargando el resumen diario:', error);
      return;
    }

    const today = new Date();
    let needsNewSummary = false;

    if (data && data.length > 0) {
      const date = new Date(data[0].created_at);
      const isToday = date.toDateString() === today.toDateString();

      if (isToday) {
        setDailySummary(data[0].summary_text);
        const formattedDate = date.toLocaleDateString('es-CO', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        setSummaryDate(`Hoy, ${formattedDate}`);
      } else {
        needsNewSummary = true;
        setDailySummary(data[0].summary_text);
        const formattedDate = date.toLocaleDateString('es-CO', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        setSummaryDate(formattedDate);
      }
    } else {
      needsNewSummary = true;
    }

    if (needsNewSummary) {
      console.log('No hay resumen de hoy, generando uno nuevo...');
      await generateDailySummary();
    }
  }

  async function generateDailySummary() {
    setIsRegenerating(true);
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) {
        console.error('No se puede generar resumen: usuario no autenticado');
        setIsRegenerating(false);
        return;
      }

      const response = await fetch('/api/cron/daily-summary', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        console.log('Resumen generado exitosamente, recargando...');
        setTimeout(() => {
          loadDailySummary();
          setIsRegenerating(false);
        }, 2000);
      } else {
        console.error('Error generando resumen:', await response.text());
        setIsRegenerating(false);
      }
    } catch (error) {
      console.error('Error al solicitar generación de resumen:', error);
      setIsRegenerating(false);
    }
  }

  // Verificar si el usuario necesita onboarding
  async function checkOnboardingStatus() {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        console.log('Usuario no autenticado');
        setCheckingOnboarding(false);
        return;
      }

      // Consultar si el usuario ha completado el onboarding
      const { data: preferences, error: prefError } = await supabase
        .from('user_preferences')
        .select('onboarding_completed')
        .eq('user_id', user.id)
        .maybeSingle();

      if (prefError) {
        console.error('Error consultando preferencias:', prefError);
        setCheckingOnboarding(false);
        return;
      }

      // Si no tiene preferencias o no ha completado onboarding, mostrar wizard
      if (!preferences || !preferences.onboarding_completed) {
        console.log('Usuario necesita completar onboarding');
        setShowOnboarding(true);
      }

      setCheckingOnboarding(false);
    } catch (error) {
      console.error('Error verificando onboarding:', error);
      setCheckingOnboarding(false);
    }
  }

  // Mostrar mensaje de bienvenida personalizado después del onboarding
  function showWelcomeMessage() {
    const templateId = localStorage.getItem('onboarding_completed_template');
    const templateName = localStorage.getItem('onboarding_template_name');
    const notionUrl = localStorage.getItem('notion_workspace_url');

    if (!templateId) return;

    // Limpiar localStorage
    localStorage.removeItem('onboarding_completed_template');
    localStorage.removeItem('onboarding_template_name');
    localStorage.removeItem('notion_workspace_url');

    // Mensajes personalizados por plantilla
    const welcomeMessages: Record<string, string> = {
      professional: `🎉 ¡Perfecto! Tu workspace "${templateName}" está listo.

He preparado para ti:
• 📋 Task & Projects Manager - Tus proyectos organizados
• 📝 Meeting Notes - Captura tus reuniones
• 📊 Dashboard Semanal - Tu resumen visual

No te preocupes por aprender Notion, yo me encargo de todo. Háblame como lo harías con un asistente personal 😊

💬 Algunos ejemplos para empezar:
• "Crea una tarea: Revisar propuesta del cliente"
• "¿Qué tengo en mi calendario hoy?"
• "Resumen de mis correos de esta semana"
${notionUrl ? `• "Abre mi workspace de Notion"` : ''}

¿Por dónde empezamos?`,

      student: `🎉 ¡Perfecto! Tu workspace "${templateName}" está listo.

He preparado para ti:
• ✅ Task Manager - Tus tareas y entregas
• 📝 Class Notes - Apuntes organizados
• 📖 Study Resources - Recursos de estudio
• 📅 Weekly Schedule - Tu horario semanal

Solo háblame naturalmente y yo organizo todo en Notion 😊

💬 Algunos ejemplos:
• "Crea una tarea: Estudiar capítulo 3 de matemáticas"
• "¿Qué entregas tengo esta semana?"
• "Agregar apunte sobre [tema]"

¿Qué necesitas hacer primero?`,

      entrepreneur: `🎉 ¡Perfecto! Tu workspace "${templateName}" está listo.

He preparado para ti:
• 🎯 OKRs & Goals - Tus objetivos clave
• 👥 CRM - Gestión de leads y clientes
• 💰 Dashboard Financiero - Control de finanzas

Háblame naturalmente y yo actualizo todo en Notion 😊

💬 Algunos ejemplos:
• "Agregar objetivo: Alcanzar 50K MRR en Q1"
• "Nuevo lead: [nombre empresa]"
• "¿Qué clientes necesitan seguimiento?"

¿Por dónde empezamos?`,

      freelancer: `🎉 ¡Perfecto! Tu workspace "${templateName}" está listo.

He preparado para ti:
• 💼 Projects - Gestión de proyectos
• 👥 Clients - Base de clientes
• ⏰ Time Tracking - Control de horas
• 💵 Invoices - Facturación

Solo háblame y yo organizo todo 😊

💬 Algunos ejemplos:
• "Nuevo proyecto: Diseño web para [cliente]"
• "Registrar 3 horas en proyecto X"
• "¿Qué facturas están pendientes?"

¿Qué hacemos primero?`,

      basic: `🎉 ¡Perfecto! Tu workspace "${templateName}" está listo.

He preparado para ti:
• ✅ My Tasks - Lista de tareas simple
• 📝 Quick Notes - Notas rápidas

Háblame naturalmente y yo me encargo de Notion 😊

💬 Algunos ejemplos:
• "Crea una tarea: Comprar leche"
• "Agregar nota sobre [tema]"
• "¿Qué tengo pendiente?"

¿Qué necesitas hacer?`
    };

    const welcomeMessage = welcomeMessages[templateId] || `🎉 ¡Tu workspace está listo! ¿Qué necesitas hacer hoy?`;

    // Quick actions personalizadas por plantilla
    const quickActionsByTemplate: Record<string, QuickAction[]> = {
      professional: [
        { label: 'Crear primera tarea', icon: '➕', action: 'Crea una tarea: Revisar propuesta del cliente' },
        { label: 'Ver mi día', icon: '📅', action: '¿Qué tengo en mi calendario hoy?' },
        { label: 'Resumen de correos', icon: '📧', action: 'Dame un resumen de mis correos de esta semana' },
        ...(notionUrl ? [{ label: 'Abrir Notion', icon: '🔗', action: notionUrl }] : [])
      ],
      student: [
        { label: 'Crear tarea', icon: '✏️', action: 'Crea una tarea: Estudiar capítulo 3 de matemáticas' },
        { label: 'Mis entregas', icon: '📚', action: '¿Qué entregas tengo esta semana?' },
        { label: 'Ver calendario', icon: '📅', action: '¿Qué tengo en mi calendario hoy?' }
      ],
      entrepreneur: [
        { label: 'Nuevo objetivo', icon: '🎯', action: 'Agregar objetivo: Alcanzar 50K MRR en Q1' },
        { label: 'Clientes pendientes', icon: '👥', action: '¿Qué clientes necesitan seguimiento?' },
        { label: 'Ver OKRs', icon: '📊', action: 'Muéstrame el progreso de mis OKRs' }
      ],
      freelancer: [
        { label: 'Nuevo proyecto', icon: '💼', action: 'Nuevo proyecto: Diseño web para cliente X' },
        { label: 'Registrar horas', icon: '⏰', action: 'Registrar 3 horas en proyecto actual' },
        { label: 'Facturas pendientes', icon: '💵', action: '¿Qué facturas están pendientes?' }
      ],
      basic: [
        { label: 'Crear tarea', icon: '✅', action: 'Crea una tarea: Comprar leche' },
        { label: 'Nueva nota', icon: '📝', action: 'Agregar nota sobre ideas del día' },
        { label: 'Ver pendientes', icon: '📋', action: '¿Qué tengo pendiente?' }
      ]
    };

    const quickActions = quickActionsByTemplate[templateId] || [];

    // Agregar mensaje del asistente con quick actions
    setMessages([{
      sender: 'ai',
      text: welcomeMessage,
      timestamp: Date.now(),
      quickActions: quickActions.length > 0 ? quickActions : undefined
    }]);
  }

  useEffect(() => {
    const status = searchParams.get('status');
    if (status === 'notion_connected') {
      setAuthStatus('¡Conexión con Notion exitosa!');
    }

    // Verificar onboarding primero
    checkOnboardingStatus();

    loadDailySummary();
  }, [searchParams]);

  // Animación de entrada inicial del header
  useGSAP(() => {
    if (headerRef.current) {
      gsap.from(headerRef.current, {
        y: -20,
        opacity: 0,
        duration: 0.6,
        ease: 'power3.out',
      });
    }
  }, { scope: containerRef });

  // Animación del resumen diario cuando aparece
  useGSAP(() => {
    if (summaryRef.current && dailySummary) {
      gsap.from(summaryRef.current, {
        y: 20,
        opacity: 0,
        scale: 0.95,
        duration: 0.5,
        ease: 'back.out(1.2)',
      });
    }
  }, { dependencies: [dailySummary], scope: containerRef });

  // Auto-scroll suave cuando hay nuevos mensajes
  useEffect(() => {
    if (messagesContainerRef.current && messages.length > 0) {
      const container = messagesContainerRef.current;
      gsap.to(container, {
        scrollTop: container.scrollHeight,
        duration: 0.5,
        ease: 'power2.out',
      });
    }
  }, [messages]);

  // Animaciones de mensajes ahora se manejan en AnimatedMessage component
  // Animación del typing indicator ahora se maneja en el componente TypingIndicator

  // Manejar click en quick actions
  const handleQuickAction = (action: string) => {
    // Si la acción es una URL (Notion), abrirla en nueva pestaña
    if (action.startsWith('http')) {
      window.open(action, '_blank');
      return;
    }

    // Si no, simular que el usuario escribió el mensaje
    setCurrentQuery(action);
    // Usar setTimeout para dar tiempo a que React actualice el estado
    setTimeout(() => {
      const form = document.querySelector('form') as HTMLFormElement;
      if (form) {
        form.requestSubmit();
      }
    }, 0);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentQuery.trim() || isLoading) return;

    const userQuery = currentQuery;
    setMessages((prev) => [...prev, {
      sender: 'user',
      text: userQuery,
      timestamp: Date.now()
    }]);
    setCurrentQuery('');
    setIsLoading(true);

    let accessToken = '';

    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (!session) throw new Error('Usuario no autenticado.');
      accessToken = session.access_token;
    } catch (error) {
      console.error('Error obteniendo la sesión:', error);
      setMessages((prev) => [...prev, {
        sender: 'ai',
        text: 'Error: No pude verificar tu sesión. Por favor, inicia sesión de nuevo.',
        timestamp: Date.now()
      }]);
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ query: userQuery }),
      });

      if (!response.ok) {
        throw new Error(`Error de API: ${response.statusText}`);
      }

      const data = await response.json();
      setMessages((prev) => [...prev, {
        sender: 'ai',
        text: data.answer,
        metadata: data.metadata,
        timestamp: Date.now()
      }]);
    } catch (error) {
      console.error('Error en la API de chat:', error);
      setMessages((prev) => [...prev, {
        sender: 'ai',
        text: 'Lo siento, algo salió mal al contactar al asistente.',
        timestamp: Date.now()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div ref={containerRef} style={{
      display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      height: '100vh',
      backgroundColor: 'var(--bg-primary)',
      color: 'var(--text-primary)',
    }}>
      {/* Desktop Sidebar - Solo mostrar en desktop */}
      {!isMobile && dailySummary && (
        <DailySummaryPanel
          summary={dailySummary}
          date={summaryDate || new Date().toLocaleDateString('es-ES')}
          onRegenerate={generateDailySummary}
          onDismiss={() => {
            setDailySummary(null);
            localStorage.setItem('summary_dismissed_date', new Date().toISOString());
          }}
          onConfigure={() => router.push('/settings?tab=preferences')}
          isLoading={isRegenerating}
        />
      )}

      {/* Contenedor principal del chat */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        height: '100vh',
        maxWidth: isMobile ? '100%' : '900px',
        margin: isMobile ? '0' : '0 auto',
        width: '100%',
      }}>
        {/* Header */}
        <header ref={headerRef} style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: 'var(--space-4) var(--space-6)',
          borderBottom: '1px solid var(--border-primary)',
          backgroundColor: 'var(--bg-secondary)',
        }}>
          <h1 style={{
            fontSize: 'var(--text-2xl)',
            fontWeight: 'var(--font-bold)',
            background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
          }}>
            <span className="icon-breathe" style={{ display: 'flex' }}>
              <BotIcon size={28} color="var(--accent-purple)" />
            </span>
            Asistente Cloution
          </h1>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button
              onClick={() => router.push('/settings')}
              style={{
                padding: 'var(--space-2) var(--space-4)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-primary)',
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                fontSize: 'var(--text-sm)',
                transition: 'all var(--transition-fast)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
              }}
            >
              <span className="icon-hover-rotate" style={{ display: 'flex' }}>
                <SettingsIcon size={16} />
              </span>
              Ajustes
            </button>
            <button
              onClick={handleSignOut}
              style={{
                padding: 'var(--space-2) var(--space-4)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--accent-red)',
                backgroundColor: 'transparent',
                color: 'var(--accent-red)',
                cursor: 'pointer',
                fontSize: 'var(--text-sm)',
                transition: 'all var(--transition-fast)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
              }}
            >
              <span className="icon-hover-scale" style={{ display: 'flex' }}>
                <LogOutIcon size={16} />
              </span>
              Cerrar Sesión
            </button>
          </div>
        </header>

        {/* Mobile Summary Card - Solo mostrar en mobile */}
        {isMobile && dailySummary && (
          <DailySummaryPanel
            summary={dailySummary}
            date={summaryDate || new Date().toLocaleDateString('es-ES')}
            onRegenerate={generateDailySummary}
            onDismiss={() => {
              setDailySummary(null);
              localStorage.setItem('summary_dismissed_date', new Date().toISOString());
            }}
            onConfigure={() => router.push('/settings?tab=preferences')}
            isLoading={isRegenerating}
          />
        )}

        {/* Mensajes */}
        <div ref={messagesContainerRef} style={{
          flex: 1,
          padding: 'var(--space-6)',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
        }}>
        {messages.map((msg, index) => (
          <AnimatedMessage key={index} sender={msg.sender}>
            {/* Mensaje */}
            <div className="message-content" style={{
              padding: 'var(--space-4)',
              borderRadius: 'var(--radius-lg)',
              maxWidth: '80%',
              backgroundColor: msg.sender === 'user' ? 'var(--accent-blue)' : 'var(--bg-secondary)',
              color: msg.sender === 'user' ? 'white' : 'var(--text-primary)',
              border: msg.sender === 'ai' ? '1px solid var(--border-primary)' : 'none',
            }}>
              <p style={{
                whiteSpace: 'pre-wrap',
                margin: 0,
                lineHeight: 'var(--leading-relaxed)',
              }}>
                {msg.text}
              </p>
            </div>

            {/* Metadata y acciones (solo para AI) */}
            {msg.sender === 'ai' && msg.metadata && (
              <div className="message-metadata" style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                fontSize: 'var(--text-xs)',
                color: 'var(--text-secondary)',
              }}>
                {msg.metadata.modelUsed && (
                  <ModelBadge model={msg.metadata.modelUsed} />
                )}
                {msg.metadata.executionTimeMs && (
                  <span style={{
                    padding: 'var(--space-1) var(--space-2)',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'var(--bg-tertiary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-1)',
                  }}>
                    <ZapIcon size={12} />
                    {(msg.metadata.executionTimeMs / 1000).toFixed(1)}s
                  </span>
                )}
                <CopyButton text={msg.text} />
              </div>
            )}

            {/* Botones de acción rápida */}
            {msg.sender === 'ai' && msg.quickActions && msg.quickActions.length > 0 && (
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 'var(--space-2)',
                marginTop: 'var(--space-3)',
              }}>
                {msg.quickActions.map((quickAction, actionIndex) => (
                  <button
                    key={actionIndex}
                    onClick={() => handleQuickAction(quickAction.action)}
                    style={{
                      padding: 'var(--space-2) var(--space-4)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-primary)',
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      fontSize: 'var(--text-sm)',
                      fontWeight: '500',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                      transition: 'all var(--transition-fast)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--accent-blue)';
                      e.currentTarget.style.color = 'white';
                      e.currentTarget.style.borderColor = 'var(--accent-blue)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(14, 165, 233, 0.2)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                      e.currentTarget.style.color = 'var(--text-primary)';
                      e.currentTarget.style.borderColor = 'var(--border-primary)';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <span>{quickAction.icon}</span>
                    <span>{quickAction.label}</span>
                  </button>
                ))}
              </div>
            )}
          </AnimatedMessage>
        ))}

        {isLoading && <TypingIndicator />}

        {messages.length === 0 && !isLoading && (
          <div style={{
            textAlign: 'center',
            color: 'var(--text-secondary)',
            marginTop: 'var(--space-16)',
          }}>
            {authStatus ? <p>{authStatus}</p> : <p>Escribe un mensaje para empezar</p>}
          </div>
        )}
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} style={{
          padding: 'var(--space-6)',
          borderTop: '1px solid var(--border-primary)',
          backgroundColor: 'var(--bg-secondary)',
          display: 'flex',
          gap: 'var(--space-3)',
        }}>
          <input
            type="text"
            value={currentQuery}
            onChange={(e) => setCurrentQuery(e.target.value)}
            placeholder="Escribe tu pregunta..."
            disabled={isLoading}
            style={{
              flex: 1,
              padding: 'var(--space-3)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-primary)',
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              fontSize: 'var(--text-base)',
              outline: 'none',
              transition: 'all var(--transition-fast)',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent-blue)';
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(14, 165, 233, 0.1)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-primary)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
          <button
            type="submit"
            disabled={isLoading || !currentQuery.trim()}
            className={!isLoading && currentQuery.trim() ? 'icon-click-bounce' : ''}
            style={{
              padding: 'var(--space-3) var(--space-6)',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              backgroundColor: isLoading || !currentQuery.trim() ? 'var(--bg-tertiary)' : 'var(--accent-blue)',
              color: 'white',
              fontSize: 'var(--text-base)',
              fontWeight: 'var(--font-semibold)',
              cursor: isLoading || !currentQuery.trim() ? 'not-allowed' : 'pointer',
              transition: 'all var(--transition-fast)',
              opacity: isLoading || !currentQuery.trim() ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
            }}
          >
            {isLoading ? (
              <SpinnerIcon size={16} />
            ) : (
              <span className="icon-hover-scale" style={{ display: 'flex' }}>
                <SendIcon size={16} />
              </span>
            )}
            Enviar
          </button>
        </form>

        {/* Onboarding Wizard */}
        {showOnboarding && !checkingOnboarding && (
          <OnboardingWizard
            onComplete={() => {
              setShowOnboarding(false);
              loadDailySummary();

              // Mostrar mensaje de bienvenida después de completar onboarding
              setTimeout(() => {
                showWelcomeMessage();
              }, 500);
            }}
            onSkip={() => {
              setShowOnboarding(false);
            }}
          />
        )}
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<Loader />}>
      <ChatUI />
    </Suspense>
  );
}
