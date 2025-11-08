'use client';

import { createSupabaseBrowserClient } from '../../lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { GoogleIcon, BotIcon, SparklesIcon } from '../../components/Icons';
import { gsap } from 'gsap';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const cardRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);

  // Animaciones GSAP de entrada
  useEffect(() => {
    const ctx = gsap.context(() => {
      // Timeline principal
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      // Animación del logo con efecto de rebote
      tl.from(logoRef.current, {
        scale: 0,
        rotation: -180,
        duration: 0.8,
        ease: 'back.out(1.7)',
      });

      // Animación del header con fade y slide
      tl.from(headerRef.current, {
        opacity: 0,
        y: 20,
        duration: 0.6,
      }, '-=0.4');

      // Animación del botón con scale
      tl.from(buttonRef.current, {
        opacity: 0,
        scale: 0.8,
        duration: 0.5,
      }, '-=0.3');

      // Animación de las features (una por una)
      tl.from(featuresRef.current?.children || [], {
        opacity: 0,
        x: -20,
        duration: 0.4,
        stagger: 0.1,
      }, '-=0.3');

      // Animación del card container
      gsap.from(cardRef.current, {
        opacity: 0,
        y: 50,
        duration: 0.8,
        ease: 'power3.out',
      });
    });

    return () => ctx.revert();
  }, []);

  // Redirige si ya hay sesión
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        router.replace('/');
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [supabase, router]);

  const handleLoginWithGoogle = () => {
    window.location.href = '/api/auth/google/redirect';
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: 'var(--bg-primary)',
      backgroundImage: `
        radial-gradient(circle at 20% 50%, rgba(14, 165, 233, 0.15) 0%, transparent 50%),
        radial-gradient(circle at 80% 80%, rgba(139, 92, 246, 0.15) 0%, transparent 50%)
      `,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Decorative background elements */}
      <div style={{
        position: 'absolute',
        top: '-10%',
        right: '-5%',
        width: '500px',
        height: '500px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(14, 165, 233, 0.1) 0%, transparent 70%)',
        filter: 'blur(60px)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        bottom: '-10%',
        left: '-5%',
        width: '500px',
        height: '500px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(139, 92, 246, 0.1) 0%, transparent 70%)',
        filter: 'blur(60px)',
        pointerEvents: 'none',
      }} />

      {/* Login Card */}
      <div
        ref={cardRef}
        style={{
          maxWidth: '420px',
          width: '100%',
          margin: '0 var(--space-4)',
        }}
      >
        {/* Glass Card */}
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-primary)',
          borderRadius: 'var(--radius-xl)',
          padding: 'var(--space-12)',
          backdropFilter: 'blur(20px)',
          boxShadow: 'var(--shadow-xl)',
        }}>
          {/* Logo & Icon */}
          <div
            ref={logoRef}
            style={{
              display: 'flex',
              justifyContent: 'center',
              marginBottom: 'var(--space-8)',
            }}
          >
            <div style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <div style={{
                position: 'absolute',
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.2), rgba(139, 92, 246, 0.2))',
                filter: 'blur(20px)',
              }} />
              <div style={{
                position: 'relative',
                width: '64px',
                height: '64px',
                borderRadius: 'var(--radius-xl)',
                background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'var(--shadow-glow-blue)',
              }}>
                <BotIcon size={32} color="white" />
              </div>
            </div>
          </div>

          {/* Header */}
          <div
            ref={headerRef}
            style={{
              textAlign: 'center',
              marginBottom: 'var(--space-10)',
            }}
          >
            <h1 style={{
              fontSize: 'var(--text-4xl)',
              fontWeight: 'var(--font-bold)',
              marginBottom: 'var(--space-3)',
              background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              Asistente Cloution
            </h1>
            <p style={{
              fontSize: 'var(--text-base)',
              color: 'var(--text-secondary)',
              marginBottom: 'var(--space-2)',
            }}>
              Tu asistente personal impulsado por IA
            </p>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-2)',
              fontSize: 'var(--text-sm)',
              color: 'var(--text-tertiary)',
            }}>
              <SparklesIcon size={14} />
              <span>Multi-modelo • RAG • Notion • Gmail</span>
            </div>
          </div>

          {/* Google Login Button */}
          <button
            ref={buttonRef}
            onClick={handleLoginWithGoogle}
            style={{
              width: '100%',
              padding: 'var(--space-4)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-primary)',
              backgroundColor: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
              fontSize: 'var(--text-base)',
              fontWeight: 'var(--font-semibold)',
              cursor: 'pointer',
              transition: 'all var(--transition-base)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-3)',
              position: 'relative',
              overflow: 'hidden',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
              e.currentTarget.style.borderColor = 'var(--border-focus)';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-elevated)';
              e.currentTarget.style.borderColor = 'var(--border-primary)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <GoogleIcon size={20} />
            Iniciar sesión con Google
          </button>

          {/* Divider */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            margin: 'var(--space-8) 0',
          }}>
            <div style={{
              flex: 1,
              height: '1px',
              backgroundColor: 'var(--border-primary)',
            }} />
            <span style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--text-tertiary)',
            }}>
              ¿Por qué Google?
            </span>
            <div style={{
              flex: 1,
              height: '1px',
              backgroundColor: 'var(--border-primary)',
            }} />
          </div>

          {/* Features List */}
          <div
            ref={featuresRef}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3)',
            }}
          >
            {[
              { text: 'Acceso a Gmail y Calendar', color: 'var(--accent-blue)' },
              { text: 'Sincronización automática de datos', color: 'var(--accent-purple)' },
              { text: 'Login seguro y sin contraseñas', color: 'var(--accent-green)' },
            ].map((feature, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--text-secondary)',
                }}
              >
                <div style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: feature.color,
                  boxShadow: `0 0 8px ${feature.color}`,
                }} />
                {feature.text}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          marginTop: 'var(--space-6)',
          textAlign: 'center',
          fontSize: 'var(--text-sm)',
          color: 'var(--text-tertiary)',
        }}>
          <p>
            Al iniciar sesión, aceptas nuestros{' '}
            <a
              href="#"
              style={{
                color: 'var(--accent-blue)',
                textDecoration: 'none',
                transition: 'color var(--transition-fast)',
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-blue-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--accent-blue)'}
            >
              términos de servicio
            </a>
            {' '}y{' '}
            <a
              href="#"
              style={{
                color: 'var(--accent-blue)',
                textDecoration: 'none',
                transition: 'color var(--transition-fast)',
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-blue-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--accent-blue)'}
            >
              política de privacidad
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
