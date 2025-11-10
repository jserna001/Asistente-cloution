'use client';

import { useState, useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { createSupabaseBrowserClient } from '../../lib/supabaseClient';
import { User } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import Loader from '../../components/Loader';
import {
  GoogleIcon,
  NotionIcon,
  UserIcon,
  SettingsIcon,
  LogOutIcon,
  CheckCircleIcon,
  AlertIcon,
  HomeIcon,
  ClockIcon,
  CheckIcon,
  XIcon,
  AnimatedIcon,
} from '../../components/Icons';
import { useNotifications, useAnimationContext } from '@/lib/animations';

interface UserPreferences {
  daily_summary_enabled: boolean;
  daily_summary_time: string;
  timezone: string;
}

type Tab = 'general' | 'connections' | 'preferences' | 'account';

export default function SettingsPage() {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();
  const { triggerSuccess, triggerError } = useNotifications();
  const { setLoading } = useAnimationContext();

  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [user, setUser] = useState<User | null>(null);
  const [connections, setConnections] = useState({ google: false, notion: false });
  const [isLoading, setIsLoading] = useState(true);
  const [preferences, setPreferences] = useState<UserPreferences>({
    daily_summary_enabled: true,
    daily_summary_time: '07:00:00',
    timezone: 'America/Bogota',
  });
  const [saving, setSaving] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const contentRef = useRef<HTMLDivElement>(null);

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
      // Simulate a longer loading time to see the loader
      setTimeout(() => setIsLoading(false), 2000);
    };

    loadUserData();
  }, [supabase]);
  
  useEffect(() => {
    if (isLoading || !contentRef.current) return;

    const ctx = gsap.context(() => {
      const panels = gsap.utils.toArray<HTMLElement>('.tab-panel');
      const initialPanel = panels.find(panel => panel.dataset.tab === activeTab);

      gsap.set(panels, {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        autoAlpha: 0,
      });

      if (initialPanel) {
        gsap.set(initialPanel, { autoAlpha: 1 });
        gsap.set(contentRef.current, { height: initialPanel.offsetHeight });
      }
    }, contentRef);

    return () => ctx.revert();
  }, [isLoading]);

  const handleTabChange = (newTab: Tab) => {
    if (newTab === activeTab || isAnimating) return;

    const outgoingPanel = contentRef.current?.querySelector<HTMLElement>(`[data-tab="${activeTab}"]`);
    const incomingPanel = contentRef.current?.querySelector<HTMLElement>(`[data-tab="${newTab}"]`);

    if (!outgoingPanel || !incomingPanel) return;

    // Update state immediately for instant feedback on the tab button
    setActiveTab(newTab);
    setIsAnimating(true);
    
    const newHeight = incomingPanel.offsetHeight;

    const tl = gsap.timeline({
      onComplete: () => {
        setIsAnimating(false);
      }
    });

    // Animate height and content fade simultaneously
    tl.to(contentRef.current, { height: newHeight, duration: 0.4, ease: 'power2.inOut' })
      .to(outgoingPanel, { autoAlpha: 0, y: -15, duration: 0.3, ease: 'power2.in' }, 0)
      .fromTo(incomingPanel, { y: 15 }, { autoAlpha: 1, y: 0, duration: 0.4, ease: 'power2.out' }, 0.1);
  };

  const handleConnectNotion = () => {
    window.location.href = '/api/auth/notion/redirect';
  };

  const handleDisconnect = async (serviceName: 'google' | 'notion') => {
    if (!user) return;

    const confirmMessage = serviceName === 'notion'
      ? '¿Estás seguro de que quieres desconectar Notion?'
      : '¿Estás seguro de que quieres desconectar Google?';

    if (!confirm(confirmMessage)) return;

    try {
      const { error } = await supabase
        .from('user_credentials')
        .delete()
        .match({ user_id: user.id, service_name: serviceName });

      if (error) throw error;

      setConnections(prev => ({ ...prev, [serviceName]: false }));
      triggerSuccess(`${serviceName === 'notion' ? 'Notion' : 'Google'} desconectado correctamente`);
    } catch (error: any) {
      console.error(`Error desconectando ${serviceName}:`, error);
      triggerError(`Error al desconectar: ${error.message}`);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleSavePreferences = async () => {
    if (!user) return;

    setSaving(true);
    setLoading(true);

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

      triggerSuccess('Preferencias guardadas correctamente');
    } catch (error: any) {
      console.error('Error guardando preferencias:', error);
      triggerError(`Error: ${error.message}`);
    } finally {
      setSaving(false);
      setLoading(false);
    }
  };

  const getTimeForInput = (time: string) => time.substring(0, 5);
  const setTimeFromInput = (time: string) => {
    setPreferences({ ...preferences, daily_summary_time: `${time}:00` });
  };

  const tabs = [
    { id: 'general' as Tab, label: 'General', icon: <UserIcon size={18} /> },
    { id: 'connections' as Tab, label: 'Conexiones', icon: <SettingsIcon size={18} /> },
    { id: 'preferences' as Tab, label: 'Preferencias', icon: <ClockIcon size={18} /> },
    { id: 'account' as Tab, label: 'Cuenta', icon: <LogOutIcon size={18} /> },
  ];

  if (isLoading) {
    return <Loader />;
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-primary)',
      padding: 'var(--space-6)',
    }}>
      {/* Header */}
      <div style={{
        maxWidth: '900px',
        margin: '0 auto var(--space-8)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--space-6)',
        }}>
          <div>
            <h1 style={{
              fontSize: 'var(--text-3xl)',
              fontWeight: 'var(--font-bold)',
              color: 'var(--text-primary)',
              marginBottom: 'var(--space-2)',
            }}>
              Configuración
            </h1>
            <p style={{
              fontSize: 'var(--text-base)',
              color: 'var(--text-secondary)',
            }}>
              Gestiona tu cuenta y preferencias
            </p>
          </div>
          <button
            onClick={() => router.push('/')}
            className="icon-click-bounce"
            style={{
              padding: 'var(--space-3) var(--space-4)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-primary)',
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              fontSize: 'var(--text-sm)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
            }}
          >
            <span className="icon-hover-scale" style={{ display: 'flex' }}>
              <HomeIcon size={16} />
            </span>
            Volver al Chat
          </button>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          gap: 'var(--space-2)',
          borderBottom: '1px solid var(--border-primary)',
          marginBottom: 'var(--space-8)',
        }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              style={{
                padding: 'var(--space-3) var(--space-5)',
                border: 'none',
                backgroundColor: 'transparent',
                color: activeTab === tab.id ? 'var(--accent-blue)' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--font-medium)',
                transition: 'all var(--transition-fast)',
                borderBottom: `2px solid ${activeTab === tab.id ? 'var(--accent-blue)' : 'transparent'}`,
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
              }}
              onMouseEnter={(e) => {
                if (activeTab !== tab.id) {
                  e.currentTarget.style.color = 'var(--text-primary)';
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== tab.id) {
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }
              }}
            >
              <span className="icon-hover-scale" style={{ display: 'flex' }}>
                {tab.icon}
              </span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div ref={contentRef} className="tab-container" style={{
        maxWidth: '900px',
        margin: '0 auto',
      }}>
        {/* General Tab */}
        <div className="tab-panel" data-tab="general">
            <div style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-primary)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-8)',
            }}>
              <h2 style={{
                fontSize: 'var(--text-xl)',
                fontWeight: 'var(--font-semibold)',
                marginBottom: 'var(--space-6)',
                color: 'var(--text-primary)',
              }}>
                Información del Usuario
              </h2>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-4)',
                padding: 'var(--space-6)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-tertiary)',
              }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <UserIcon size={32} color="white" />
                </div>
                <div>
                  <div style={{
                    fontSize: 'var(--text-lg)',
                    fontWeight: 'var(--font-semibold)',
                    color: 'var(--text-primary)',
                    marginBottom: 'var(--space-1)',
                  }}>
                    {user?.user_metadata?.full_name || user?.email || 'Usuario'}
                  </div>
                  <div style={{
                    fontSize: 'var(--text-sm)',
                    color: 'var(--text-secondary)',
                  }}>
                    {user?.email}
                  </div>
                </div>
              </div>
            </div>
          </div>

        {/* Connections Tab */}
        <div className="tab-panel" data-tab="connections">
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-4)',
            }}>
              {/* Google Card */}
              <div style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-primary)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-4)',
                }}>
                  <span className="icon-breathe" style={{ display: 'flex' }}>
                    <GoogleIcon size={32} />
                  </span>
                  <div>
                    <div style={{
                      fontSize: 'var(--text-lg)',
                      fontWeight: 'var(--font-semibold)',
                      color: 'var(--text-primary)',
                      marginBottom: 'var(--space-1)',
                    }}>
                      Google
                    </div>
                    <div style={{
                      fontSize: 'var(--text-sm)',
                      color: 'var(--text-secondary)',
                    }}>
                      Gmail y Calendar
                    </div>
                  </div>
                </div>
                {connections.google ? (
                  <div className="icon-pop-in" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    padding: 'var(--space-2) var(--space-4)',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    color: 'var(--status-success)',
                    fontSize: 'var(--text-sm)',
                  }}>
                    <span className="icon-success-pulse" style={{ display: 'flex' }}>
                      <CheckCircleIcon size={16} />
                    </span>
                    Conectado
                  </div>
                ) : (
                  <div className="icon-pop-in" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    padding: 'var(--space-2) var(--space-4)',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    color: 'var(--status-warning)',
                    fontSize: 'var(--text-sm)',
                  }}>
                    <span className="icon-shake" style={{ display: 'flex' }}>
                      <AlertIcon size={16} />
                    </span>
                    No conectado
                  </div>
                )}
              </div>

              {/* Notion Card */}
              <div style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-primary)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-4)',
                }}>
                  <span className="icon-breathe" style={{ display: 'flex' }}>
                    <NotionIcon size={32} />
                  </span>
                  <div>
                    <div style={{
                      fontSize: 'var(--text-lg)',
                      fontWeight: 'var(--font-semibold)',
                      color: 'var(--text-primary)',
                      marginBottom: 'var(--space-1)',
                    }}>
                      Notion
                    </div>
                    <div style={{
                      fontSize: 'var(--text-sm)',
                      color: 'var(--text-secondary)',
                    }}>
                      Páginas y bases de datos
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  {connections.notion && (
                    <div className="icon-pop-in" style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                      padding: 'var(--space-2) var(--space-4)',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: 'rgba(16, 185, 129, 0.1)',
                      color: 'var(--status-success)',
                      fontSize: 'var(--text-sm)',
                    }}>
                      <span className="icon-success-pulse" style={{ display: 'flex' }}>
                        <CheckCircleIcon size={16} />
                      </span>
                      Conectado
                    </div>
                  )}
                  <button
                    onClick={() => connections.notion ? handleDisconnect('notion') : handleConnectNotion()}
                    className="icon-click-bounce"
                    style={{
                      padding: 'var(--space-2) var(--space-4)',
                      borderRadius: 'var(--radius-md)',
                      border: 'none',
                      backgroundColor: connections.notion ? 'var(--accent-red)' : 'var(--accent-blue)',
                      color: 'white',
                      cursor: 'pointer',
                      fontSize: 'var(--text-sm)',
                      fontWeight: 'var(--font-semibold)',
                      transition: 'all var(--transition-fast)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = connections.notion ? 'var(--accent-red-hover)' : 'var(--accent-blue-hover)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = connections.notion ? 'var(--accent-red)' : 'var(--accent-blue)';
                    }}
                  >
                    {connections.notion ? 'Desconectar' : 'Conectar'}
                  </button>
                </div>
              </div>
            </div>
          </div>

        {/* Preferences Tab */}
        <div className="tab-panel" data-tab="preferences">
            <div style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-primary)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-8)',
            }}>
              <h2 style={{
                fontSize: 'var(--text-xl)',
                fontWeight: 'var(--font-semibold)',
                marginBottom: 'var(--space-2)',
                color: 'var(--text-primary)',
              }}>
                Resumen Diario
              </h2>
              <p style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--text-secondary)',
                marginBottom: 'var(--space-6)',
              }}>
                Configura cuándo recibir tu resumen diario automático
              </p>

              {/* Toggle */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 'var(--space-4)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-tertiary)',
                marginBottom: 'var(--space-6)',
              }}>
                <div>
                  <div style={{
                    fontSize: 'var(--text-base)',
                    fontWeight: 'var(--font-medium)',
                    color: 'var(--text-primary)',
                    marginBottom: 'var(--space-1)',
                  }}>
                    Resumen diario activado
                  </div>
                  <div style={{
                    fontSize: 'var(--text-sm)',
                    color: 'var(--text-secondary)',
                  }}>
                    Recibe un resumen de tus actividades cada mañana
                  </div>
                </div>
                <label style={{
                  position: 'relative',
                  display: 'inline-block',
                  width: '50px',
                  height: '28px',
                  cursor: 'pointer',
                }}>
                  <input
                    type="checkbox"
                    checked={preferences.daily_summary_enabled}
                    onChange={(e) => setPreferences({ ...preferences, daily_summary_enabled: e.target.checked })}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: preferences.daily_summary_enabled ? 'var(--accent-blue)' : 'var(--bg-elevated)',
                    transition: 'var(--transition-base)',
                    borderRadius: '28px',
                  }}>
                    <span style={{
                      position: 'absolute',
                      height: '20px',
                      width: '20px',
                      left: preferences.daily_summary_enabled ? '26px' : '4px',
                      bottom: '4px',
                      backgroundColor: 'white',
                      transition: 'var(--transition-base)',
                      borderRadius: '50%',
                    }} />
                  </span>
                </label>
              </div>

              {/* Time and Timezone (conditional) */}
              {preferences.daily_summary_enabled && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-6)',
                  marginBottom: 'var(--space-6)',
                }}>
                  {/* Time */}
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: 'var(--text-sm)',
                      fontWeight: 'var(--font-medium)',
                      color: 'var(--text-primary)',
                      marginBottom: 'var(--space-2)',
                    }}>
                      Hora del resumen
                    </label>
                    <input
                      type="time"
                      value={getTimeForInput(preferences.daily_summary_time)}
                      onChange={(e) => setTimeFromInput(e.target.value)}
                      style={{
                        width: '100%',
                        padding: 'var(--space-3)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-primary)',
                        backgroundColor: 'var(--bg-tertiary)',
                        color: 'var(--text-primary)',
                        fontSize: 'var(--text-base)',
                      }}
                    />
                  </div>

                  {/* Timezone */}
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: 'var(--text-sm)',
                      fontWeight: 'var(--font-medium)',
                      color: 'var(--text-primary)',
                      marginBottom: 'var(--space-2)',
                    }}>
                      Zona horaria
                    </label>
                    <select
                      value={preferences.timezone}
                      onChange={(e) => setPreferences({ ...preferences, timezone: e.target.value })}
                      style={{
                        width: '100%',
                        padding: 'var(--space-3)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-primary)',
                        backgroundColor: 'var(--bg-tertiary)',
                        color: 'var(--text-primary)',
                        fontSize: 'var(--text-base)',
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
                </div>
              )}

              {/* Save Button */}
              <button
                onClick={handleSavePreferences}
                disabled={saving}
                style={{
                  width: '100%',
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  backgroundColor: saving ? 'var(--bg-tertiary)' : 'var(--accent-blue)',
                  color: 'white',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontSize: 'var(--text-base)',
                  fontWeight: 'var(--font-semibold)',
                  transition: 'all var(--transition-fast)',
                  opacity: saving ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 'var(--space-2)',
                }}
                onMouseEnter={(e) => {
                  if (!saving) e.currentTarget.style.backgroundColor = 'var(--accent-blue-hover)';
                }}
                onMouseLeave={(e) => {
                  if (!saving) e.currentTarget.style.backgroundColor = 'var(--accent-blue)';
                }}
              >
                {saving ? (
                  <>
                    <AnimatedIcon animation="spin" trigger="loop">
                      <div style={{
                        width: '16px',
                        height: '16px',
                        border: '2px solid white',
                        borderTopColor: 'transparent',
                        borderRadius: '50%',
                      }} />
                    </AnimatedIcon>
                    Guardando...
                  </>
                ) : (
                  <>
                    <AnimatedIcon animation="bounce" trigger="hover">
                      <CheckIcon size={16} />
                    </AnimatedIcon>
                    Guardar cambios
                  </>
                )}
              </button>

            </div>
          </div>

        {/* Account Tab */}
        <div className="tab-panel" data-tab="account">
            <div style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-primary)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-8)',
            }}>
              <h2 style={{
                fontSize: 'var(--text-xl)',
                fontWeight: 'var(--font-semibold)',
                marginBottom: 'var(--space-6)',
                color: 'var(--text-primary)',
              }}>
                Gestión de Cuenta
              </h2>

              {/* Logout Section */}
              <div style={{
                padding: 'var(--space-6)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-primary)',
                backgroundColor: 'var(--bg-tertiary)',
              }}>
                <div style={{
                  fontSize: 'var(--text-base)',
                  fontWeight: 'var(--font-medium)',
                  color: 'var(--text-primary)',
                  marginBottom: 'var(--space-2)',
                }}>
                  Cerrar sesión
                </div>
                <p style={{
                  fontSize: 'var(--text-sm)',
                  color: 'var(--text-secondary)',
                  marginBottom: 'var(--space-4)',
                }}>
                  Cierra tu sesión actual en este dispositivo
                </p>
                <button
                  onClick={handleLogout}
                  style={{
                    padding: 'var(--space-3) var(--space-5)',
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    backgroundColor: 'var(--accent-red)',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 'var(--font-semibold)',
                    transition: 'all var(--transition-fast)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--accent-red-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--accent-red)';
                  }}
                >
                  <LogOutIcon size={16} />
                  Cerrar Sesión
                </button>
              </div>
            </div>
          </div>
      </div>
    </div>
  );
}
