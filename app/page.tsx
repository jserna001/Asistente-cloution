'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '../lib/supabaseClient';
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
} from '../components/Icons';

// Tipos de mensajes mejorados
interface MessageMetadata {
  modelUsed?: string;
  taskType?: string;
  executionTimeMs?: number;
}

interface Message {
  sender: 'user' | 'ai';
  text: string;
  metadata?: MessageMetadata;
  timestamp: number;
}

// Componente de Badge de Modelo
function ModelBadge({ model }: { model: string }) {
  const getModelInfo = (modelName: string) => {
    if (modelName.includes('flash')) {
      return {
        icon: <ZapIcon size={14} />,
        label: 'Gemini Flash',
        color: 'var(--model-gemini-flash)'
      };
    } else if (modelName.includes('gemini-2.5-pro')) {
      return {
        icon: <BrainIcon size={14} />,
        label: 'Gemini Pro',
        color: 'var(--model-gemini-pro)'
      };
    } else if (modelName.includes('claude')) {
      return {
        icon: <BotIcon size={14} />,
        label: 'Claude Sonnet',
        color: 'var(--model-claude)'
      };
    }
    return {
      icon: <BrainIcon size={14} />,
      label: model,
      color: 'var(--text-secondary)'
    };
  };

  const { icon, label, color } = getModelInfo(model);

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 'var(--space-1)',
      padding: 'var(--space-1) var(--space-2)',
      borderRadius: 'var(--radius-full)',
      backgroundColor: `${color}15`,
      color: color,
      fontSize: 'var(--text-xs)',
      fontWeight: 'var(--font-medium)',
      border: `1px solid ${color}30`,
    }}>
      {icon}
      {label}
    </span>
  );
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
          <CheckIcon size={14} />
          Copiado
        </>
      ) : (
        <>
          <CopyIcon size={14} />
          Copiar
        </>
      )}
    </button>
  );
}

import Loader from '../components/Loader';

function ChatUI() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentQuery, setCurrentQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [authStatus, setAuthStatus] = useState<string | null>(null);
  const [dailySummary, setDailySummary] = useState<string | null>(null);
  const [summaryDate, setSummaryDate] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

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
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) {
        console.error('No se puede generar resumen: usuario no autenticado');
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
        }, 2000);
      } else {
        console.error('Error generando resumen:', await response.text());
      }
    } catch (error) {
      console.error('Error al solicitar generación de resumen:', error);
    }
  }

  useEffect(() => {
    const status = searchParams.get('status');
    if (status === 'notion_connected') {
      setAuthStatus('¡Conexión con Notion exitosa!');
    }

    loadDailySummary();
  }, [searchParams]);

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
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      maxWidth: '900px',
      margin: '0 auto',
      backgroundColor: 'var(--bg-primary)',
      color: 'var(--text-primary)',
    }}>
      {/* Header */}
      <header style={{
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
          <BotIcon size={28} color="var(--accent-purple)" />
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
            <SettingsIcon size={16} />
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
            <LogOutIcon size={16} />
            Cerrar Sesión
          </button>
        </div>
      </header>

      {/* Resumen Diario */}
      {dailySummary && (
        <div style={{
          margin: 'var(--space-6)',
          padding: 'var(--space-6)',
          borderRadius: 'var(--radius-lg)',
          background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.1), rgba(139, 92, 246, 0.1))',
          border: '1px solid var(--border-primary)',
        }} className="animate-slide-up">
          {summaryDate && (
            <div style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--text-secondary)',
              marginBottom: 'var(--space-3)',
              fontWeight: 'var(--font-medium)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
            }}>
              <CalendarIcon size={16} />
              {summaryDate}
            </div>
          )}
          <pre style={{
            whiteSpace: 'pre-wrap',
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-sm)',
            lineHeight: 'var(--leading-relaxed)',
            margin: 0,
          }}>
            {dailySummary}
          </pre>
        </div>
      )}

      {/* Mensajes */}
      <div style={{
        flex: 1,
        padding: 'var(--space-6)',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
      }}>
        {messages.map((msg, index) => (
          <div
            key={index}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start',
              gap: 'var(--space-2)',
            }}
            className="animate-fade-in"
          >
            {/* Mensaje */}
            <div style={{
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
              <div style={{
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
          </div>
        ))}

        {isLoading && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-4)',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-primary)',
            maxWidth: '80%',
          }} className="animate-pulse">
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: 'var(--accent-blue)',
            }} />
            <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Pensando...</p>
          </div>
        )}

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
          {isLoading ? <SpinnerIcon size={16} /> : <SendIcon size={16} />}
          Enviar
        </button>
      </form>
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
