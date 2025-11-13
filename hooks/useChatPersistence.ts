'use client';

import { useEffect, useRef } from 'react';
import { createSupabaseBrowserClient } from '../lib/supabaseClient';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  metadata?: any;
  timestamp: number;
  quickActions?: any[];
  status?: 'sending' | 'sent' | 'failed';
  error?: string;
}

interface PersistenceConfig {
  localStorage: {
    enabled: boolean;
    key: string;
    maxMessages: number; // Guardar solo últimos N mensajes
  };
  supabase: {
    enabled: boolean;
    minMessages: number; // No guardar conversaciones triviales
    saveOnExit: boolean;
  };
}

const DEFAULT_CONFIG: PersistenceConfig = {
  localStorage: {
    enabled: true,
    key: 'chat_messages',
    maxMessages: 100,
  },
  supabase: {
    enabled: true,
    minMessages: 4, // Al menos 4 mensajes (2 del usuario + 2 del AI)
    saveOnExit: true,
  },
};

export function useChatPersistence(
  messages: Message[],
  setMessages: (messages: Message[]) => void,
  config: Partial<PersistenceConfig> = {}
) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const supabase = createSupabaseBrowserClient();
  const sessionStartRef = useRef<Date>(new Date());
  const sessionSavedRef = useRef(false);
  const isInitializedRef = useRef(false);

  // ============ PASO 1: Cargar desde localStorage al iniciar ============
  useEffect(() => {
    if (!finalConfig.localStorage.enabled || isInitializedRef.current) return;

    try {
      const saved = localStorage.getItem(finalConfig.localStorage.key);
      if (saved) {
        const parsed: Message[] = JSON.parse(saved);

        // Filtrar mensajes en estado 'sending' (no se completaron)
        const validMessages = parsed.filter(m => m.status !== 'sending');

        if (validMessages.length > 0) {
          console.log(`📦 Cargados ${validMessages.length} mensajes desde localStorage`);
          setMessages(validMessages);
        }
      }
    } catch (error) {
      console.error('Error cargando mensajes desde localStorage:', error);
    } finally {
      isInitializedRef.current = true;
    }
  }, []);

  // ============ PASO 2: Guardar en localStorage cada vez que cambian ============
  useEffect(() => {
    if (!finalConfig.localStorage.enabled || messages.length === 0) return;

    try {
      // Limitar a los últimos N mensajes
      const messagesToSave = messages.slice(-finalConfig.localStorage.maxMessages);
      localStorage.setItem(finalConfig.localStorage.key, JSON.stringify(messagesToSave));

      // Debug solo para cambios importantes
      if (messages.length % 5 === 0) {
        console.log(`💾 Guardados ${messagesToSave.length} mensajes en localStorage`);
      }
    } catch (error) {
      console.error('Error guardando en localStorage:', error);
    }
  }, [messages, finalConfig.localStorage.enabled, finalConfig.localStorage.key, finalConfig.localStorage.maxMessages]);

  // ============ PASO 3: Determinar si sesión es importante ============
  const shouldSaveSession = (): boolean => {
    if (!finalConfig.supabase.enabled) return false;
    if (sessionSavedRef.current) return false; // Ya se guardó
    if (messages.length < finalConfig.supabase.minMessages) return false;

    // Debe tener al menos 1 respuesta del AI
    const hasAIResponse = messages.some(m => m.sender === 'ai' && !m.quickActions);
    if (!hasAIResponse) return false;

    // Debe tener al menos 1 mensaje del usuario completado exitosamente
    const hasUserMessage = messages.some(m => m.sender === 'user' && m.status === 'sent');
    if (!hasUserMessage) return false;

    return true;
  };

  // ============ PASO 4: Guardar sesión a Supabase ============
  const saveChatSession = async () => {
    if (!shouldSaveSession()) {
      console.log('⏭️  Sesión no cumple criterios para guardado en Supabase');
      return;
    }

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        console.error('No se puede guardar sesión: usuario no autenticado');
        return;
      }

      // Preparar datos
      const sessionEnd = new Date();
      const sessionData = {
        user_id: user.id,
        session_start: sessionStartRef.current.toISOString(),
        session_end: sessionEnd.toISOString(),
        message_count: messages.length,
        messages: messages,
        metadata: {
          device: navigator.userAgent.includes('Mobile') ? 'mobile' : 'desktop',
          session_duration_ms: sessionEnd.getTime() - sessionStartRef.current.getTime(),
          last_model_used: messages
            .filter(m => m.metadata?.modelUsed)
            .slice(-1)[0]?.metadata?.modelUsed || 'unknown',
        },
      };

      // Insertar en Supabase
      const { error: insertError } = await supabase
        .from('chat_sessions')
        .insert(sessionData);

      if (insertError) {
        console.error('Error guardando sesión en Supabase:', insertError);
        return;
      }

      sessionSavedRef.current = true;
      console.log(`☁️  Sesión guardada en Supabase: ${messages.length} mensajes`);

      // Limpiar sesiones antiguas (mantener solo últimas 50)
      await supabase.rpc('cleanup_old_chat_sessions');
    } catch (error) {
      console.error('Error en saveChatSession:', error);
    }
  };

  // ============ PASO 5: Guardar al salir (beforeunload) ============
  useEffect(() => {
    if (!finalConfig.supabase.saveOnExit) return;

    const handleBeforeUnload = async () => {
      if (!shouldSaveSession()) return;

      try {
        // Obtener token de sesión
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // Usar sendBeacon para garantizar envío antes de cerrar
        const sessionEnd = new Date();
        const sessionData = {
          token: session.access_token, // Enviar token en el body
          session_start: sessionStartRef.current.toISOString(),
          session_end: sessionEnd.toISOString(),
          message_count: messages.length,
          messages: messages,
          metadata: {
            device: navigator.userAgent.includes('Mobile') ? 'mobile' : 'desktop',
            session_duration_ms: sessionEnd.getTime() - sessionStartRef.current.getTime(),
          },
        };

        const blob = new Blob([JSON.stringify(sessionData)], { type: 'application/json' });
        navigator.sendBeacon('/api/chat/save-session', blob);

        console.log('📤 Sesión enviada vía sendBeacon al cerrar');
      } catch (error) {
        console.error('Error en beforeunload:', error);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [messages, finalConfig.supabase.saveOnExit, finalConfig.supabase.minMessages, supabase]);

  // ============ PASO 6: Auto-save periódico (opcional, deshabilitado por defecto) ============
  // Comentado porque queremos solo save on exit
  // useEffect(() => {
  //   const interval = setInterval(saveChatSession, 5 * 60 * 1000); // Cada 5 minutos
  //   return () => clearInterval(interval);
  // }, [messages]);

  // Retornar funciones útiles
  return {
    saveChatSession, // Para guardar manualmente si es necesario
    clearLocalStorage: () => {
      localStorage.removeItem(finalConfig.localStorage.key);
      console.log('🗑️  localStorage limpiado');
    },
    sessionInfo: {
      sessionStart: sessionStartRef.current,
      messageCount: messages.length,
      sessionSaved: sessionSavedRef.current,
      shouldSave: shouldSaveSession(),
    },
  };
}
