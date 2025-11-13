'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { createSupabaseBrowserClient } from '@/lib/supabaseClient';
import {
  BotIcon,
  SparklesIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  CalendarIcon,
  NotionIcon,
  GlobeIcon,
} from '@/components/Icons';

gsap.registerPlugin(useGSAP);

interface OnboardingData {
  fullName: string;
  timezone: string;
  notionConnected: boolean;
  dailySummaryEnabled: boolean;
  dailySummaryTime: string;
}

// Tipos para los pasos del wizard
type WizardStep = 1 | 2 | 3;

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createSupabaseBrowserClient();

  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Estado del formulario
  const [formData, setFormData] = useState<OnboardingData>({
    fullName: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Bogota',
    notionConnected: false,
    dailySummaryEnabled: true,
    dailySummaryTime: '07:00',
  });

  // Referencias para animaciones
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const stepContentRef = useRef<HTMLDivElement>(null);

  // Verificar autenticación y cargar datos iniciales
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error || !user) {
        router.push('/login');
        return;
      }

      setUserId(user.id);

      // Cargar nombre desde metadata de Google si está disponible
      if (user.user_metadata?.full_name || user.user_metadata?.name) {
        setFormData(prev => ({
          ...prev,
          fullName: user.user_metadata?.full_name || user.user_metadata?.name || '',
        }));
      }

      // Verificar si viene de un paso específico (onboarding incompleto)
      const stepParam = searchParams?.get('step');
      if (stepParam) {
        const step = parseInt(stepParam);
        if (step >= 1 && step <= 3) {
          setCurrentStep(step as WizardStep);
        }
      }
    };

    checkAuth();
  }, [supabase, router, searchParams]);

  // Animación de entrada
  useGSAP(() => {
    if (containerRef.current && cardRef.current) {
      gsap.from(containerRef.current, {
        opacity: 0,
        duration: 0.5,
        ease: 'power2.out',
      });

      gsap.from(cardRef.current, {
        y: 30,
        opacity: 0,
        scale: 0.95,
        duration: 0.6,
        ease: 'back.out(1.2)',
        delay: 0.2,
      });
    }
  }, { scope: containerRef });

  // Animación al cambiar de paso
  useGSAP(() => {
    if (stepContentRef.current) {
      gsap.from(stepContentRef.current, {
        x: 20,
        opacity: 0,
        duration: 0.4,
        ease: 'power2.out',
      });
    }
  }, { dependencies: [currentStep], scope: containerRef });

  // Navegar entre pasos
  const handleNext = async () => {
    if (currentStep < 3) {
      await saveProgress(currentStep + 1 as WizardStep);
      setCurrentStep(prev => (prev + 1) as WizardStep);
    } else {
      await completeOnboarding();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => (prev - 1) as WizardStep);
    }
  };

  const handleSkip = async () => {
    await skipOnboarding();
  };

  // Guardar progreso en la base de datos
  const saveProgress = async (step: WizardStep) => {
    if (!userId) return;

    try {
      // Guardar en user_preferences en lugar de la vista
      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: userId,
          timezone: formData.timezone,
        }, { onConflict: 'user_id' });

      if (error) {
        console.error('Error guardando progreso:', error);
      }
    } catch (error) {
      console.error('Error en saveProgress:', error);
    }
  };

  // Completar onboarding
  const completeOnboarding = async () => {
    if (!userId) return;

    setIsLoading(true);

    try {
      // Guardar preferencias del usuario y marcar onboarding como completado
      const { error: prefsError } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: userId,
          onboarding_completed: true,
          daily_summary_enabled: formData.dailySummaryEnabled,
          daily_summary_time: formData.dailySummaryTime + ':00',
          timezone: formData.timezone,
        }, { onConflict: 'user_id' });

      if (prefsError) throw prefsError;

      // Redirigir al dashboard
      router.push('/?status=onboarding_complete');

    } catch (error) {
      console.error('Error completando onboarding:', error);
      alert('Hubo un error al completar el onboarding. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  // Saltar onboarding
  const skipOnboarding = async () => {
    if (!userId) return;

    try {
      // Marcar onboarding como completado (aunque sea saltado)
      await supabase
        .from('user_preferences')
        .upsert({
          user_id: userId,
          onboarding_completed: true,
        }, { onConflict: 'user_id' });

      router.push('/?status=onboarding_skipped');
    } catch (error) {
      console.error('Error al saltar onboarding:', error);
    }
  };

  // Validación para habilitar botón "Siguiente"
  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.fullName.trim().length > 0;
      case 2:
        return true; // Notion es opcional
      case 3:
        return true; // Siempre puede proceder
      default:
        return false;
    }
  };

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        width: '100vw',
        backgroundColor: 'var(--bg-primary)',
        backgroundImage: `
          radial-gradient(circle at 20% 50%, rgba(14, 165, 233, 0.1) 0%, transparent 40%),
          radial-gradient(circle at 80% 80%, rgba(139, 92, 246, 0.1) 0%, transparent 40%)
        `,
        position: 'relative',
        overflow: 'hidden',
        padding: 'var(--space-4)',
      }}
    >
      <div
        ref={cardRef}
        style={{
          maxWidth: '520px',
          width: '100%',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div
          style={{
            backgroundColor: 'rgba(17, 17, 17, 0.7)',
            border: '1px solid var(--border-primary)',
            borderRadius: 'var(--radius-xl)',
            padding: 'var(--space-10)',
            backdropFilter: 'blur(20px)',
            boxShadow: 'var(--shadow-xl)',
          }}
        >
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '56px',
                height: '56px',
                borderRadius: 'var(--radius-lg)',
                background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))',
                marginBottom: 'var(--space-4)',
                boxShadow: 'var(--shadow-glow-blue)',
              }}
            >
              <span className="icon-breathe" style={{ display: 'flex' }}>
                <BotIcon size={28} color="white" />
              </span>
            </div>
            <h1
              style={{
                fontSize: 'var(--text-3xl)',
                fontWeight: 'var(--font-bold)',
                marginBottom: 'var(--space-2)',
                background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              ¡Bienvenido a Asistente!
            </h1>
            <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)' }}>
              Configuremos tu experiencia en 3 pasos
            </p>
          </div>

          {/* Progress Indicator */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-2)',
              marginBottom: 'var(--space-8)',
            }}
          >
            {[1, 2, 3].map((step) => (
              <div
                key={step}
                style={{
                  flex: 1,
                  height: '4px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor:
                    step <= currentStep ? 'var(--accent-blue)' : 'var(--border-primary)',
                  transition: 'all var(--transition-base)',
                }}
              />
            ))}
          </div>

          {/* Step Content */}
          <div ref={stepContentRef}>
            {currentStep === 1 && (
              <Step1Welcome
                formData={formData}
                setFormData={setFormData}
              />
            )}
            {currentStep === 2 && (
              <Step2Integrations
                formData={formData}
                setFormData={setFormData}
              />
            )}
            {currentStep === 3 && (
              <Step3Preferences
                formData={formData}
                setFormData={setFormData}
              />
            )}
          </div>

          {/* Navigation */}
          <div
            style={{
              display: 'flex',
              gap: 'var(--space-3)',
              marginTop: 'var(--space-8)',
            }}
          >
            {currentStep > 1 && (
              <button
                onClick={handleBack}
                disabled={isLoading}
                className={!isLoading ? 'icon-click-bounce' : ''}
                style={{
                  padding: 'var(--space-3) var(--space-5)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border-primary)',
                  backgroundColor: 'var(--bg-elevated)',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--text-base)',
                  fontWeight: 'var(--font-semibold)',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  transition: 'all var(--transition-base)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  opacity: isLoading ? 0.5 : 1,
                }}
              >
                <span className="icon-hover-scale" style={{ display: 'flex' }}>
                  <ArrowLeftIcon size={18} />
                </span>
                Atrás
              </button>
            )}

            <button
              onClick={handleSkip}
              disabled={isLoading}
              style={{
                padding: 'var(--space-3) var(--space-5)',
                borderRadius: 'var(--radius-lg)',
                border: 'none',
                backgroundColor: 'transparent',
                color: 'var(--text-secondary)',
                fontSize: 'var(--text-sm)',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                transition: 'all var(--transition-base)',
                marginLeft: currentStep === 1 ? '0' : 'auto',
              }}
            >
              Saltar
            </button>

            <button
              onClick={handleNext}
              disabled={!canProceed() || isLoading}
              className={canProceed() && !isLoading ? 'icon-click-bounce' : ''}
              style={{
                flex: 1,
                padding: 'var(--space-3) var(--space-6)',
                borderRadius: 'var(--radius-lg)',
                border: 'none',
                background: canProceed()
                  ? 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))'
                  : 'var(--bg-secondary)',
                color: 'white',
                fontSize: 'var(--text-base)',
                fontWeight: 'var(--font-semibold)',
                cursor: canProceed() && !isLoading ? 'pointer' : 'not-allowed',
                transition: 'all var(--transition-base)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-2)',
                opacity: canProceed() && !isLoading ? 1 : 0.5,
                marginLeft: currentStep === 1 ? 'auto' : '0',
              }}
            >
              {isLoading ? (
                'Guardando...'
              ) : currentStep === 3 ? (
                <>
                  <span className="icon-success-pulse" style={{ display: 'flex' }}>
                    <CheckCircleIcon size={18} />
                  </span>
                  Completar
                </>
              ) : (
                <>
                  Siguiente
                  <span className="icon-hover-scale" style={{ display: 'flex' }}>
                    <ArrowRightIcon size={18} />
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Wrapper con Suspense para manejar useSearchParams
export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: 'var(--bg-primary)',
      }}>
        <div style={{ color: 'var(--text-secondary)' }}>Cargando...</div>
      </div>
    }>
      <OnboardingContent />
    </Suspense>
  );
}

// ===== STEP COMPONENTS =====

interface StepProps {
  formData: OnboardingData;
  setFormData: React.Dispatch<React.SetStateAction<OnboardingData>>;
}

function Step1Welcome({ formData, setFormData }: StepProps) {
  // Lista de zonas horarias comunes
  const commonTimezones = [
    'America/Bogota',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Mexico_City',
    'America/Sao_Paulo',
    'Europe/London',
    'Europe/Paris',
    'Asia/Tokyo',
    'Australia/Sydney',
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            display: 'inline-flex',
            padding: 'var(--space-2) var(--space-4)',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'rgba(14, 165, 233, 0.1)',
            border: '1px solid rgba(14, 165, 233, 0.3)',
            marginBottom: 'var(--space-4)',
          }}
        >
          <SparklesIcon size={16} color="var(--accent-blue)" />
          <span
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--accent-blue)',
              marginLeft: 'var(--space-2)',
            }}
          >
            Paso 1 de 3
          </span>
        </div>
        <h2
          style={{
            fontSize: 'var(--text-2xl)',
            fontWeight: 'var(--font-bold)',
            marginBottom: 'var(--space-2)',
            color: 'var(--text-primary)',
          }}
        >
          Cuéntanos sobre ti
        </h2>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          Personaliza tu experiencia con algunos datos básicos
        </p>
      </div>

      <div>
        <label
          style={{
            display: 'block',
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--font-medium)',
            color: 'var(--text-primary)',
            marginBottom: 'var(--space-2)',
          }}
        >
          Nombre completo
        </label>
        <input
          type="text"
          value={formData.fullName}
          onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
          placeholder="Tu nombre"
          style={{
            width: '100%',
            padding: 'var(--space-3)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-primary)',
            backgroundColor: 'var(--bg-elevated)',
            color: 'var(--text-primary)',
            fontSize: 'var(--text-base)',
            outline: 'none',
            transition: 'all var(--transition-base)',
          }}
          onFocus={(e) => {
            e.target.style.borderColor = 'var(--accent-blue)';
            e.target.style.boxShadow = '0 0 0 3px rgba(14, 165, 233, 0.1)';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = 'var(--border-primary)';
            e.target.style.boxShadow = 'none';
          }}
        />
      </div>

      <div>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-1)',
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--font-medium)',
            color: 'var(--text-primary)',
            marginBottom: 'var(--space-2)',
          }}
        >
          <GlobeIcon size={14} />
          Zona horaria
        </label>
        <select
          value={formData.timezone}
          onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
          style={{
            width: '100%',
            padding: 'var(--space-3)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-primary)',
            backgroundColor: 'var(--bg-elevated)',
            color: 'var(--text-primary)',
            fontSize: 'var(--text-base)',
            outline: 'none',
            cursor: 'pointer',
            transition: 'all var(--transition-base)',
          }}
        >
          {commonTimezones.map((tz) => (
            <option key={tz} value={tz}>
              {tz.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--space-2)' }}>
          Se detectó automáticamente tu zona horaria actual
        </p>
      </div>
    </div>
  );
}

function Step2Integrations({ formData, setFormData }: StepProps) {
  const handleConnectNotion = () => {
    // Redirigir al flujo OAuth de Notion con origen 'onboarding'
    window.location.href = '/api/auth/notion/redirect?from=onboarding';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            display: 'inline-flex',
            padding: 'var(--space-2) var(--space-4)',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'rgba(139, 92, 246, 0.1)',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            marginBottom: 'var(--space-4)',
          }}
        >
          <SparklesIcon size={16} color="var(--accent-purple)" />
          <span
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--accent-purple)',
              marginLeft: 'var(--space-2)',
            }}
          >
            Paso 2 de 3
          </span>
        </div>
        <h2
          style={{
            fontSize: 'var(--text-2xl)',
            fontWeight: 'var(--font-bold)',
            marginBottom: 'var(--space-2)',
            color: 'var(--text-primary)',
          }}
        >
          Conecta tus herramientas
        </h2>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          Opcional: conecta Notion para potenciar tu asistente
        </p>
      </div>

      <div
        style={{
          padding: 'var(--space-6)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-primary)',
          backgroundColor: 'var(--bg-elevated)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'start', gap: 'var(--space-4)' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <NotionIcon size={24} />
          </div>
          <div style={{ flex: 1 }}>
            <h3
              style={{
                fontSize: 'var(--text-lg)',
                fontWeight: 'var(--font-semibold)',
                marginBottom: 'var(--space-1)',
                color: 'var(--text-primary)',
              }}
            >
              Notion
            </h3>
            <p
              style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--text-secondary)',
                marginBottom: 'var(--space-4)',
              }}
            >
              Gestiona tareas, notas y proyectos directamente desde el asistente
            </p>

            <ul
              style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--text-secondary)',
                marginBottom: 'var(--space-4)',
                paddingLeft: 'var(--space-4)',
              }}
            >
              <li>✓ Crear y buscar páginas</li>
              <li>✓ Gestionar bases de datos</li>
              <li>✓ Actualizar contenido automáticamente</li>
            </ul>

            <button
              onClick={handleConnectNotion}
              disabled={formData.notionConnected}
              style={{
                padding: 'var(--space-2) var(--space-4)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-primary)',
                backgroundColor: formData.notionConnected
                  ? 'var(--bg-secondary)'
                  : 'var(--bg-elevated)',
                color: formData.notionConnected ? 'var(--accent-green)' : 'var(--text-primary)',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--font-semibold)',
                cursor: formData.notionConnected ? 'default' : 'pointer',
                transition: 'all var(--transition-base)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
              }}
            >
              {formData.notionConnected ? (
                <>
                  <CheckCircleIcon size={16} />
                  Conectado
                </>
              ) : (
                'Conectar Notion'
              )}
            </button>
          </div>
        </div>
      </div>

      <div
        style={{
          padding: 'var(--space-4)',
          borderRadius: 'var(--radius-lg)',
          backgroundColor: 'rgba(14, 165, 233, 0.05)',
          border: '1px solid rgba(14, 165, 233, 0.2)',
        }}
      >
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          💡 <strong>Nota:</strong> Puedes conectar Notion más tarde desde la configuración
        </p>
      </div>
    </div>
  );
}

function Step3Preferences({ formData, setFormData }: StepProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            display: 'inline-flex',
            padding: 'var(--space-2) var(--space-4)',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            marginBottom: 'var(--space-4)',
          }}
        >
          <SparklesIcon size={16} color="var(--accent-green)" />
          <span
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--accent-green)',
              marginLeft: 'var(--space-2)',
            }}
          >
            Paso 3 de 3
          </span>
        </div>
        <h2
          style={{
            fontSize: 'var(--text-2xl)',
            fontWeight: 'var(--font-bold)',
            marginBottom: 'var(--space-2)',
            color: 'var(--text-primary)',
          }}
        >
          Configura tu asistente
        </h2>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          Personaliza cómo y cuándo recibes información
        </p>
      </div>

      <div
        style={{
          padding: 'var(--space-6)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-primary)',
          backgroundColor: 'var(--bg-elevated)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'start', gap: 'var(--space-4)' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: 'var(--radius-lg)',
              background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <CalendarIcon size={24} color="white" />
          </div>
          <div style={{ flex: 1 }}>
            <h3
              style={{
                fontSize: 'var(--text-lg)',
                fontWeight: 'var(--font-semibold)',
                marginBottom: 'var(--space-1)',
                color: 'var(--text-primary)',
              }}
            >
              Resumen Diario
            </h3>
            <p
              style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--text-secondary)',
                marginBottom: 'var(--space-4)',
              }}
            >
              Recibe un resumen automático de tus correos, calendario y tareas
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--text-primary)',
                }}
              >
                <input
                  type="checkbox"
                  checked={formData.dailySummaryEnabled}
                  onChange={(e) =>
                    setFormData({ ...formData, dailySummaryEnabled: e.target.checked })
                  }
                  style={{
                    marginRight: 'var(--space-2)',
                    width: '18px',
                    height: '18px',
                    cursor: 'pointer',
                  }}
                />
                Habilitar resumen diario
              </label>
            </div>

            {formData.dailySummaryEnabled && (
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 'var(--font-medium)',
                    color: 'var(--text-primary)',
                    marginBottom: 'var(--space-2)',
                  }}
                >
                  Hora del resumen
                </label>
                <input
                  type="time"
                  value={formData.dailySummaryTime}
                  onChange={(e) =>
                    setFormData({ ...formData, dailySummaryTime: e.target.value })
                  }
                  style={{
                    width: '100%',
                    padding: 'var(--space-3)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--border-primary)',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: 'var(--text-base)',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        style={{
          padding: 'var(--space-4)',
          borderRadius: 'var(--radius-lg)',
          backgroundColor: 'rgba(16, 185, 129, 0.05)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
        }}
      >
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          🎉 <strong>¡Casi listo!</strong> Puedes cambiar estas preferencias en cualquier momento
        </p>
      </div>
    </div>
  );
}
