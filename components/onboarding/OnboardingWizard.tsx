'use client';

/**
 * OnboardingWizard Component
 *
 * Wizard interactivo de onboarding que guía al usuario a:
 * 1. Seleccionar su perfil (Estudiante, Profesional, etc.)
 * 2. Ver preview de la plantilla recomendada
 * 3. Instalar la plantilla en su Notion
 * 4. Configurar preferencias de resumen diario
 *
 * Se muestra automáticamente en el primer login si el usuario
 * no ha completado el onboarding.
 */

import { useState, useEffect } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

// =====================================================
// TIPOS
// =====================================================

interface Template {
  id: string;
  template_pack_id: string;
  name: string;
  description: string;
  icon: string;
  target_audience: string[];
  hasStructure: boolean;
  display_order: number;
}

interface OnboardingWizardProps {
  onComplete: () => void;
  onSkip?: () => void;
}

// =====================================================
// DATA ESTÁTICA
// =====================================================

const TEMPLATE_DETAILS: Record<string, {
  features: string[];
  benefits: string[];
  ideal_for: string;
}> = {
  student: {
    features: [
      'Task Manager con calendario de entregas',
      'Base de datos de apuntes con método Cornell',
      'Horario semanal de clases',
      'Recursos de estudio organizados'
    ],
    benefits: [
      'Nunca olvides una entrega',
      'Apuntes organizados por materia',
      'Visualiza tu semana completa'
    ],
    ideal_for: 'Estudiantes, aprendices online, cursos universitarios'
  },
  professional: {
    features: [
      'Task & Projects Manager con Kanban',
      'Notas de reuniones con action items',
      'Dashboard semanal de productividad',
      'Knowledge Base para documentación'
    ],
    benefits: [
      'Gestiona múltiples proyectos fácilmente',
      'No pierdas información de reuniones',
      'Centraliza el conocimiento de tu equipo'
    ],
    ideal_for: 'Empleados, project managers, equipos remotos'
  },
  entrepreneur: {
    features: [
      'OKRs & Goals con tracking',
      'CRM para leads y clientes',
      'Dashboard financiero',
      'Product Roadmap'
    ],
    benefits: [
      'Mantén el foco en objetivos clave',
      'Gestiona tu pipeline de ventas',
      'Controla tus finanzas en tiempo real'
    ],
    ideal_for: 'Fundadores, startups, negocios pequeños'
  },
  freelancer: {
    features: [
      'Gestor de proyectos con deadlines',
      'Base de clientes con contactos',
      'Time tracking para facturación',
      'Control de facturas y pagos'
    ],
    benefits: [
      'Nunca pierdas de vista un deadline',
      'Factura basado en horas reales',
      'Mantén control de tus cobros'
    ],
    ideal_for: 'Freelancers, consultores, trabajadores independientes'
  },
  basic: {
    features: [
      'Lista de tareas simple',
      'Notas rápidas con tags',
      'Lista de compras'
    ],
    benefits: [
      'Empieza rápido sin complicaciones',
      'Aprende Notion a tu ritmo',
      'Expande cuando estés listo'
    ],
    ideal_for: 'Todos, principiantes en Notion'
  }
};

// =====================================================
// COMPONENTE PRINCIPAL
// =====================================================

export default function OnboardingWizard({ onComplete, onSkip }: OnboardingWizardProps) {
  const [step, setStep] = useState(1);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [installing, setInstalling] = useState(false);
  const [installProgress, setInstallProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  const supabase = createSupabaseBrowserClient();
  const router = useRouter();

  // Cargar catálogo de plantillas al montar
  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoadingTemplates(true);
      const response = await fetch('/api/onboarding/templates');
      const data = await response.json();

      if (data.success) {
        setTemplates(data.templates);
      } else {
        setError('No se pudieron cargar las plantillas');
      }
    } catch (err: any) {
      console.error('Error cargando plantillas:', err);
      setError('Error de conexión');
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleSelectTemplate = (template: Template) => {
    setSelectedTemplate(template);
    setError(null);
  };

  const handleNextStep = () => {
    if (step === 1 && !selectedTemplate) {
      setError('Por favor selecciona una plantilla');
      return;
    }
    setStep(step + 1);
    setError(null);
  };

  const handleInstallTemplate = async () => {
    if (!selectedTemplate) return;

    setInstalling(true);
    setInstallProgress(0);
    setError(null);

    // Simular progreso mientras esperamos respuesta
    const progressInterval = setInterval(() => {
      setInstallProgress(prev => {
        if (prev >= 90) return prev;
        return prev + 10;
      });
    }, 1000);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Sesión no válida. Por favor inicia sesión nuevamente.');
      }

      const response = await fetch('/api/onboarding/install-template', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          templatePackId: selectedTemplate.template_pack_id
        })
      });

      const result = await response.json();

      clearInterval(progressInterval);
      setInstallProgress(100);

      if (result.success) {
        // Marcar onboarding como completado
        await supabase
          .from('user_preferences')
          .upsert({
            user_id: session.user.id,
            onboarding_completed: true,
            onboarding_completed_at: new Date().toISOString(),
            selected_template_pack: selectedTemplate.template_pack_id,
            template_installed: true
          }, {
            onConflict: 'user_id'
          });

        // Avanzar al paso final
        setStep(4);

        // Guardar información de la plantilla para el chat
        localStorage.setItem('onboarding_completed_template', selectedTemplate.template_pack_id);
        localStorage.setItem('onboarding_template_name', selectedTemplate.name);
        localStorage.setItem('notion_workspace_url', result.notionWorkspaceUrl || '');

      } else {
        if (result.needsNotionAuth) {
          setError('Necesitas conectar tu cuenta de Notion primero. Redirigiendo...');
          setTimeout(() => {
            router.push('/settings?tab=connections');
          }, 2000);
        } else {
          setError(result.error || 'Error desconocido al instalar la plantilla');
        }
      }

    } catch (err: any) {
      console.error('Error instalando plantilla:', err);
      setError(err.message || 'Error de conexión. Por favor intenta nuevamente.');
      clearInterval(progressInterval);
    } finally {
      setInstalling(false);
    }
  };

  const handleSkip = () => {
    if (onSkip) {
      onSkip();
    } else {
      onComplete();
    }
  };

  // =====================================================
  // RENDERIZADO
  // =====================================================

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-modal">
        {/* Header */}
        <div className="onboarding-header">
          <div className="onboarding-progress">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${(step / 4) * 100}%` }}
              />
            </div>
            <p className="progress-text">Paso {step} de 4</p>
          </div>
          {step < 4 && (
            <button onClick={handleSkip} className="skip-button">
              Saltar onboarding
            </button>
          )}
        </div>

        {/* Contenido según el paso */}
        <div className="onboarding-content">
          {/* PASO 1: Selección de plantilla */}
          {step === 1 && (
            <div className="step-container">
              <h1 className="onboarding-title">🎉 ¡Bienvenido a tu Asistente IA!</h1>
              <p className="onboarding-subtitle">
                Vamos a configurar tu workspace perfecto en Notion.
                Selecciona la plantilla que mejor se ajuste a ti:
              </p>

              {loadingTemplates ? (
                <div className="loading-state">
                  <div className="spinner" />
                  <p>Cargando plantillas...</p>
                </div>
              ) : (
                <div className="templates-grid">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className={`template-card ${
                        selectedTemplate?.id === template.id ? 'selected' : ''
                      }`}
                      onClick={() => handleSelectTemplate(template)}
                    >
                      <div className="template-icon">{template.icon}</div>
                      <h3 className="template-name">{template.name}</h3>
                      <p className="template-description">{template.description}</p>
                      <div className="template-audience">
                        <small>Para: {template.target_audience.join(', ')}</small>
                      </div>
                      {selectedTemplate?.id === template.id && (
                        <div className="selected-badge">✓ Seleccionado</div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {error && <div className="error-message">{error}</div>}

              <div className="step-actions">
                <button
                  onClick={handleNextStep}
                  disabled={!selectedTemplate}
                  className="primary-button"
                >
                  Siguiente →
                </button>
              </div>
            </div>
          )}

          {/* PASO 2: Preview de la plantilla */}
          {step === 2 && selectedTemplate && (
            <div className="step-container">
              <h1 className="onboarding-title">
                {selectedTemplate.icon} {selectedTemplate.name}
              </h1>
              <p className="onboarding-subtitle">{selectedTemplate.description}</p>

              <div className="template-preview">
                <div className="preview-section">
                  <h3>✨ Lo que incluye:</h3>
                  <ul className="features-list">
                    {TEMPLATE_DETAILS[selectedTemplate.template_pack_id]?.features.map(
                      (feature, idx) => (
                        <li key={idx}>
                          <span className="feature-icon">✓</span>
                          {feature}
                        </li>
                      )
                    )}
                  </ul>
                </div>

                <div className="preview-section">
                  <h3>🎯 Beneficios:</h3>
                  <ul className="benefits-list">
                    {TEMPLATE_DETAILS[selectedTemplate.template_pack_id]?.benefits.map(
                      (benefit, idx) => (
                        <li key={idx}>
                          <span className="benefit-icon">→</span>
                          {benefit}
                        </li>
                      )
                    )}
                  </ul>
                </div>

                <div className="ideal-for">
                  <p>
                    <strong>Ideal para:</strong>{' '}
                    {TEMPLATE_DETAILS[selectedTemplate.template_pack_id]?.ideal_for}
                  </p>
                </div>
              </div>

              <div className="step-actions">
                <button onClick={() => setStep(1)} className="secondary-button">
                  ← Cambiar plantilla
                </button>
                <button onClick={handleNextStep} className="primary-button">
                  ¡Me gusta! Continuar →
                </button>
              </div>
            </div>
          )}

          {/* PASO 3: Instalación */}
          {step === 3 && selectedTemplate && (
            <div className="step-container">
              <h1 className="onboarding-title">🚀 Instalando tu workspace</h1>
              <p className="onboarding-subtitle">
                Estamos creando tu workspace personalizado en Notion...
                Esto tomará aproximadamente 30 segundos.
              </p>

              {!installing ? (
                <>
                  <div className="install-preview">
                    <div className="preview-icon">{selectedTemplate.icon}</div>
                    <h2>{selectedTemplate.name}</h2>
                    <p>Se crearán databases, páginas y vistas automáticamente</p>
                  </div>

                  {error && <div className="error-message">{error}</div>}

                  <div className="step-actions">
                    <button onClick={() => setStep(2)} className="secondary-button">
                      ← Volver
                    </button>
                    <button
                      onClick={handleInstallTemplate}
                      disabled={installing}
                      className="primary-button install-button"
                    >
                      🎨 Instalar plantilla
                    </button>
                  </div>
                </>
              ) : (
                <div className="installing-state">
                  <div className="spinner large" />
                  <div className="progress-bar large">
                    <div
                      className="progress-fill"
                      style={{ width: `${installProgress}%` }}
                    />
                  </div>
                  <p className="progress-label">{installProgress}%</p>
                  <p className="installing-message">
                    Creando databases y páginas...
                    <br />
                    <small>No cierres esta ventana</small>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* PASO 4: Completado */}
          {step === 4 && (
            <div className="step-container success">
              <div className="success-animation">
                <div className="success-icon">🎉</div>
                <h1 className="onboarding-title">¡Todo listo!</h1>
                <p className="onboarding-subtitle">
                  Tu workspace ha sido creado exitosamente en Notion.
                </p>
              </div>

              <div className="success-details">
                <div className="success-card">
                  <h3>✅ Workspace configurado</h3>
                  <p>Databases, páginas y vistas creadas</p>
                </div>
                <div className="success-card">
                  <h3>🤖 Resumen diario activado</h3>
                  <p>Recibirás tu primer resumen mañana</p>
                </div>
                <div className="success-card">
                  <h3>💬 Chat listo para usar</h3>
                  <p>Ya puedes hacer preguntas sobre tu Notion</p>
                </div>
              </div>

              <div className="next-steps">
                <p><strong>Próximo paso:</strong></p>
                <p style={{ marginTop: '8px', opacity: 0.9 }}>
                  Vamos al chat donde te guiaré para empezar a usar tu nuevo workspace.
                  No necesitas aprender Notion, solo háblame naturalmente 😊
                </p>
              </div>

              <div className="step-actions">
                <button onClick={onComplete} className="primary-button large">
                  💬 Empecemos a conversar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
