'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '../lib/supabaseClient';

// Definimos los tipos de mensajes
interface Message {
  sender: 'user' | 'ai';
  text: string;
}

function ChatUI() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentQuery, setCurrentQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [authStatus, setAuthStatus] = useState<string | null>(null);
  const [dailySummary, setDailySummary] = useState<string | null>(null);
  
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  /**
   * Carga el resumen diario para el USUARIO AUTENTICADO.
   * RLS (Row Level Security) en Supabase se encarga de filtrar
   * los resúmenes basándose en el usuario logueado.
   */
  async function loadDailySummary() {
    console.log('Cargando resumen diario...');
    
    // El cliente de Supabase (browser) usa automáticamente el token
    // de sesión para autenticar esta solicitud. RLS lo filtrará.
    const { data, error } = await supabase
      .from('daily_summaries')
      .select('summary_text')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error cargando el resumen diario:', error);
      return;
    }

    if (data && data.length > 0) {
      setDailySummary(data[0].summary_text);
    } else {
      console.log('No se encontró resumen diario.');
    }
  }

  // Efecto de carga inicial
  useEffect(() => {
    // Comprobar estado de conexión (de la redirección de Notion)
    const status = searchParams.get('status');
    if (status === 'notion_connected') {
      setAuthStatus('¡Conexión con Notion exitosa');
    }

    // Cargar el resumen diario
    loadDailySummary();
  }, [searchParams]);

  /**
   * Maneja el envío del formulario de chat.
   * Ahora envía el token de autenticación del usuario.
   */
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentQuery.trim() || isLoading) return;

    const userQuery = currentQuery;
    setMessages((prev) => [...prev, { sender: 'user', text: userQuery }]);
    setCurrentQuery('');
    setIsLoading(true);

    let accessToken = '';

    // 1. Obtener el token de sesión de Supabase
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (!session) throw new Error('Usuario no autenticado.');
      accessToken = session.access_token;
    } catch (error) {
      console.error('Error obteniendo la sesión:', error);
      setMessages((prev) => [...prev, { sender: 'ai', text: 'Error: No pude verificar tu sesión. Por favor, inicia sesión de nuevo.' }]);
      setIsLoading(false);
      return;
    }

    // 2. Enviar el token en el header "Authorization"
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`, // <-- ¡EL PASAPORTE
        },
        body: JSON.stringify({ query: userQuery }),
      });

      if (!response.ok) {
        throw new Error(`Error de API: ${response.statusText}`);
      }

      const data = await response.json();
      setMessages((prev) => [...prev, { sender: 'ai', text: data.answer }]);
    } catch (error) {
      console.error('Error en la API de chat:', error);
      setMessages((prev) => [...prev, { sender: 'ai', text: 'Lo siento, algo salió mal al contactar al asistente.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div className="chat-container">
      <header className="chat-header">
        <h1>Asistente Personal</h1>
        <button onClick={() => router.push('/settings')} className="settings-button">Ajustes</button>
        <button onClick={handleSignOut} className="signout-button">Cerrar Sesión</button>
      </header>

      {/* Contenedor del Resumen Diario */}
      {dailySummary && (
        <div className="summary-container">
          <pre className="summary-text">{dailySummary}</pre>
        </div>
      )}
      
      {/* Contenedor de Mensajes de Chat */}
      <div className="messages-container">
        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.sender}`}>
            <p>{msg.text}</p>
          </div>
        ))}
        {isLoading && (
          <div className="message ai">
            <p>Pensando...</p>
          </div>
        )}
        {messages.length === 0 && !isLoading && (
          <div className="message-placeholder">
            {authStatus ? <p>{authStatus}</p> : <p>El historial de chat está vacío.</p>}
          </div>
        )}
      </div>

      {/* Input de Chat */}
      <form onSubmit={handleSubmit} className="chat-input-form">
        <input
          type="text"
          value={currentQuery}
          onChange={(e) => setCurrentQuery(e.target.value)}
          placeholder="Escribe tu pregunta..."
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading}>Enviar</button>
      </form>

      {/* Estilos (CSS Básico) */}
      <style jsx>{`
        .chat-container { display: flex; flex-direction: column; height: 100vh; max-width: 800px; margin: 0 auto; background: #1c1c1c; color: white; border-radius: 8px; overflow: hidden; }
        .chat-header { display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: #2a2a2a; border-bottom: 1px solid #333; }
        .chat-header h1 { font-size: 1.25rem; margin: 0; }
        .settings-button, .signout-button { background: #333; border: none; color: white; padding: 0.5rem 1rem; border-radius: 5px; cursor: pointer; }
        .signout-button { background: #5a2a2a; }
        .summary-container { background: #2a2a2a; padding: 1rem; margin: 1rem; border-radius: 8px; }
        .summary-text { white-space: pre-wrap; font-family: inherit; font-size: 0.9rem; line-height: 1.5; }
        .messages-container { flex: 1; padding: 1rem; overflow-y: auto; display: flex; flex-direction: column; gap: 1rem; }
        .message { padding: 0.75rem 1rem; border-radius: 12px; max-width: 80%; }
        .message.user { background: #0070f3; color: white; align-self: flex-end; }
        .message.ai { background: #333; color: white; align-self: flex-start; }
        .message.ai p { white-space: pre-wrap; }
        .message-placeholder { text-align: center; color: #777; }
        .chat-input-form { display: flex; padding: 1rem; background: #2a2a2a; border-top: 1px solid #333; }
        .chat-input-form input { flex: 1; padding: 0.75rem; border: none; border-radius: 5px; background: #444; color: white; }
        .chat-input-form button { padding: 0.75rem 1rem; margin-left: 0.5rem; background: #0070f3; color: white; border: none; border-radius: 5px; cursor: pointer; }
      `}</style>
    </div>
  );
}

// Envolvemos el componente en Suspense para que useSearchParams() funcione
export default function ChatPage() {
  return (
    <Suspense fallback={<div>Cargando...</div>}>
      <ChatUI />
    </Suspense>
  );
}
