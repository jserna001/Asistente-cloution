'use client';

import { useState, useEffect } from 'react';
import { createSupabaseBrowserClient } from '../../lib/supabaseClient';
import { User } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

// --- Iconos ---
const CheckmarkIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="#34D399" xmlns="http://www.w3.org/2000/svg">
    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="currentColor"/>
  </svg>
);

const GoogleIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
);

const NotionIcon = () => (
    <svg width="24" height="24" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M25.75 10.3333H32.5V31.6667H25.75V10.3333Z" fill="#fff"/>
        <path d="M7.5 8.33331C7.5 8.33331 15.8333 8.33331 17.5 8.33331C18.3333 8.33331 22.5 8.33331 22.5 12.5C22.5 16.6667 17.5 15.8333 17.5 15.8333L22.5 25C22.5 29.1667 18.3333 29.1667 17.5 29.1667C15.8333 29.1667 7.5 29.1667 7.5 29.1667V8.33331Z" fill="#fff"/>
        <path d="M12.5 10.3333V26.6666" stroke="#000" strokeWidth="3.33333" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

interface UserPreferences {
  daily_summary_enabled: boolean;
  daily_summary_time: string;
  timezone: string;
}

export default function SettingsPage() {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [connections, setConnections] = useState({ google: false, notion: false });
  const [isLoading, setIsLoading] = useState(true);
  const [preferences, setPreferences] = useState<UserPreferences>({
    daily_summary_enabled: true,
    daily_summary_time: '07:00:00',
    timezone: 'America/Bogota',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        // Cargar credenciales
        const { data: credentials, error } = await supabase
          .from('user_credentials')
          .select('service_name')
          .eq('user_id', user.id);

        if (error) {
          console.error('Error cargando las credenciales:', error);
        } else {
          const newConnections = { google: false, notion: false };
          credentials.forEach(cred => {
            if (cred.service_name === 'google') newConnections.google = true;
            if (cred.service_name === 'notion') newConnections.notion = true;
          });
          setConnections(newConnections);
        }

        // Cargar preferencias de resumen diario
        const { data: prefs, error: prefsError } = await supabase
          .from('user_preferences')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (!prefsError && prefs) {
          setPreferences({
            daily_summary_enabled: prefs.daily_summary_enabled,
            daily_summary_time: prefs.daily_summary_time,
            timezone: prefs.timezone,
          });
        }
      }
      setIsLoading(false);
    };

    loadUserData();
  }, [supabase]);

  const handleConnectNotion = () => {
    // Esta URL será creada en un paso posterior.
    window.location.href = '/api/auth/notion/redirect';
  };

  const handleDisconnect = async (serviceName: 'google' | 'notion') => {
    if (!user) return;

    // Confirmación antes de desconectar
    const confirmMessage = serviceName === 'notion'
      ? '¿Estás seguro de que quieres desconectar Notion? Perderás acceso a tus páginas y bases de datos.'
      : '¿Estás seguro de que quieres desconectar Google?';

    if (!confirm(confirmMessage)) return;

    try {
      setMessage('Desconectando...');

      // Eliminar credencial de la base de datos
      const { error } = await supabase
        .from('user_credentials')
        .delete()
        .match({ user_id: user.id, service_name: serviceName });

      if (error) throw error;

      // Actualizar estado local
      setConnections(prev => ({ ...prev, [serviceName]: false }));
      setMessage(`✓ ${serviceName === 'notion' ? 'Notion' : 'Google'} desconectado correctamente`);

      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      console.error(`Error desconectando ${serviceName}:`, error);
      setMessage(`Error al desconectar: ${error.message}`);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleSavePreferences = async () => {
    if (!user) return;

    setSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          daily_summary_enabled: preferences.daily_summary_enabled,
          daily_summary_time: preferences.daily_summary_time,
          timezone: preferences.timezone,
        });

      if (error) throw error;

      setMessage('✓ Preferencias guardadas');
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      console.error('Error guardando preferencias:', error);
      setMessage(`Error: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const getTimeForInput = (time: string) => time.substring(0, 5);
  const setTimeFromInput = (time: string) => {
    setPreferences({ ...preferences, daily_summary_time: `${time}:00` });
  };

  const styles = {
    page: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh', backgroundColor: '#121212', color: '#E5E5E7', padding: '2rem' } as React.CSSProperties,
    header: { width: '100%', maxWidth: '600px', marginBottom: '2rem' } as React.CSSProperties,
    title: { fontSize: '2rem', fontWeight: 600, marginBottom: '0.5rem' } as React.CSSProperties,
    subtitle: { fontSize: '1rem', color: '#8E8E93' } as React.CSSProperties,
    card: { backgroundColor: '#1c1c1e', borderRadius: '12px', padding: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: '600px', marginBottom: '1rem' } as React.CSSProperties,
    serviceInfo: { display: 'flex', alignItems: 'center', gap: '1rem' } as React.CSSProperties,
    serviceName: { fontSize: '1.1rem', fontWeight: 500 } as React.CSSProperties,
    statusBadge: { display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#34D399', backgroundColor: 'rgba(52, 211, 153, 0.1)', padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.9rem' } as React.CSSProperties,
    connectButton: { fontSize: '0.9rem', padding: '8px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#0A84FF', color: 'white', cursor: 'pointer' } as React.CSSProperties,
    logoutButton: { marginTop: '2rem', fontSize: '1rem', color: '#8E8E93', background: 'none', border: 'none', cursor: 'pointer' } as React.CSSProperties,
  };

  if (isLoading) {
    return <div style={styles.page}>Cargando...</div>;
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>Panel de Conexiones</h1>
        <p style={styles.subtitle}>Gestiona tus aplicaciones y servicios conectados.</p>
      </div>

      {/* Tarjeta de Google */}
      <div style={styles.card}>
        <div style={styles.serviceInfo}>
          <GoogleIcon />
          <span style={styles.serviceName}>Google</span>
        </div>
        {connections.google ? (
          <div style={styles.statusBadge}>
            <CheckmarkIcon />
            Conectado
          </div>
        ) : (
          <p style={{color: '#FBBF24'}}>No conectado</p>
        )}
      </div>

      {/* Tarjeta de Notion */}
      <div style={styles.card}>
        <div style={styles.serviceInfo}>
          <NotionIcon />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={styles.serviceName}>Notion</span>
            {connections.notion && (
              <div style={styles.statusBadge}>
                <CheckmarkIcon />
                Conectado
              </div>
            )}
          </div>
        </div>
        {connections.notion ? (
          <button
            onClick={() => handleDisconnect('notion')}
            style={{
              ...styles.connectButton,
              backgroundColor: '#FF3B30',
            }}
          >
            Desconectar
          </button>
        ) : (
          <button onClick={handleConnectNotion} style={styles.connectButton}>Conectar</button>
        )}
      </div>

      {/* Sección de Resumen Diario */}
      <div style={{ ...styles.card, flexDirection: 'column', alignItems: 'stretch', gap: '1.5rem', marginTop: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 600, marginBottom: '0.5rem' }}>Resumen Diario</h2>
          <p style={{ fontSize: '0.9rem', color: '#8E8E93' }}>Configura cuándo quieres recibir tu resumen diario automático.</p>
        </div>

        {/* Toggle para habilitar/deshabilitar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '1rem' }}>Resumen diario activado</span>
          <label style={{ position: 'relative', display: 'inline-block', width: '50px', height: '28px' }}>
            <input
              type="checkbox"
              checked={preferences.daily_summary_enabled}
              onChange={(e) => setPreferences({ ...preferences, daily_summary_enabled: e.target.checked })}
              style={{ opacity: 0, width: 0, height: 0 }}
            />
            <span style={{
              position: 'absolute',
              cursor: 'pointer',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: preferences.daily_summary_enabled ? '#0A84FF' : '#3A3A3C',
              transition: '0.4s',
              borderRadius: '28px',
            }}>
              <span style={{
                position: 'absolute',
                content: '',
                height: '20px',
                width: '20px',
                left: preferences.daily_summary_enabled ? '26px' : '4px',
                bottom: '4px',
                backgroundColor: 'white',
                transition: '0.4s',
                borderRadius: '50%',
              }} />
            </span>
          </label>
        </div>

        {/* Configuración de hora y zona horaria (solo si está habilitado) */}
        {preferences.daily_summary_enabled && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label htmlFor="summary-time" style={{ fontSize: '0.95rem', color: '#E5E5E7' }}>
                Hora del resumen
              </label>
              <input
                id="summary-time"
                type="time"
                value={getTimeForInput(preferences.daily_summary_time)}
                onChange={(e) => setTimeFromInput(e.target.value)}
                style={{
                  backgroundColor: '#2C2C2E',
                  border: '1px solid #3A3A3C',
                  borderRadius: '8px',
                  padding: '0.75rem',
                  color: '#E5E5E7',
                  fontSize: '1rem',
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label htmlFor="timezone" style={{ fontSize: '0.95rem', color: '#E5E5E7' }}>
                Zona horaria
              </label>
              <select
                id="timezone"
                value={preferences.timezone}
                onChange={(e) => setPreferences({ ...preferences, timezone: e.target.value })}
                style={{
                  backgroundColor: '#2C2C2E',
                  border: '1px solid #3A3A3C',
                  borderRadius: '8px',
                  padding: '0.75rem',
                  color: '#E5E5E7',
                  fontSize: '1rem',
                }}
              >
                <option value="America/Bogota">Bogotá (GMT-5)</option>
                <option value="America/New_York">Nueva York (GMT-5)</option>
                <option value="America/Los_Angeles">Los Ángeles (GMT-8)</option>
                <option value="America/Mexico_City">Ciudad de México (GMT-6)</option>
                <option value="America/Argentina/Buenos_Aires">Buenos Aires (GMT-3)</option>
                <option value="Europe/Madrid">Madrid (GMT+1)</option>
                <option value="Europe/London">Londres (GMT+0)</option>
                <option value="Asia/Tokyo">Tokio (GMT+9)</option>
              </select>
            </div>
          </>
        )}

        {/* Botón de guardar */}
        <button
          onClick={handleSavePreferences}
          disabled={saving}
          style={{
            ...styles.connectButton,
            backgroundColor: saving ? '#3A3A3C' : '#0A84FF',
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>

        {/* Mensaje de confirmación/error */}
        {message && (
          <div style={{
            padding: '0.75rem',
            borderRadius: '8px',
            backgroundColor: message.includes('Error') ? 'rgba(255, 59, 48, 0.1)' : 'rgba(52, 211, 153, 0.1)',
            color: message.includes('Error') ? '#FF3B30' : '#34D399',
            fontSize: '0.9rem',
          }}>
            {message}
          </div>
        )}
      </div>

      <button onClick={handleLogout} style={styles.logoutButton}>Cerrar Sesión</button>
    </div>
  );
}
