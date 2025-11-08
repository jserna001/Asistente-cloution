'use client';

import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/navigation';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';

import Loader from '../../components/Loader';
import { createSupabaseBrowserClient } from '../../lib/supabaseClient';
import { GoogleIcon, BotIcon, SparklesIcon } from '../../components/Icons';
import styles from '../LoginPage.module.css';

// --- UI Component for the detailed Login Screen ---
function LoginUI({ isTransitioning }: { isTransitioning: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const auraRef = useRef<HTMLDivElement>(null);

  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  // Entrance animation for the whole container (Zoom In)
  useGSAP(() => {
    if (isTransitioning) {
      gsap.to(containerRef.current, {
        scale: 1,
        filter: 'blur(0px)',
        autoAlpha: 1,
        duration: 1.2,
        ease: 'power2.out',
      });
    }
  }, { dependencies: [isTransitioning], scope: containerRef });

  // Internal animations for the card elements
  useGSAP(() => {
    if (!isTransitioning) return; // Only run after the main transition starts

    const tl = gsap.timeline({
      defaults: { ease: 'power3.out' },
      delay: 0.5 // Start internal animations slightly after the container starts zooming in
    });

    tl.from(logoRef.current, { scale: 0, rotation: -180, duration: 0.8, ease: 'back.out(1.7)' });
    tl.from(headerRef.current, { opacity: 0, y: 20, duration: 0.6 }, '-=0.4');
    tl.from(featuresRef.current?.children || [], { opacity: 0, x: -20, duration: 0.4, stagger: 0.1 }, '-=0.3');
    
  }, { dependencies: [isTransitioning], scope: containerRef });
  
  // Aura effect
  useGSAP(() => {
    if (!isTransitioning) return;
    const aura = auraRef.current;
    if (!aura) return;
    
    gsap.to(aura, { opacity: 1, duration: 1, ease: 'power3.out', delay: 0.8 });

    const onMouseMove = (e: MouseEvent) => {
      gsap.to(aura, { x: e.clientX, y: e.clientY, duration: 0.7, ease: 'power3.out' });
    };
    window.addEventListener('mousemove', onMouseMove);
    return () => window.removeEventListener('mousemove', onMouseMove);

  }, { dependencies: [isTransitioning] });

  const handleLoginWithGoogle = () => {
    window.location.href = '/api/auth/google/redirect';
  };

  return (
    <div className={styles.loginContainer} ref={containerRef}>
        <div
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
                cursor: 'default',
            }}
        >
            <div ref={auraRef} style={{ position: 'fixed', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(14, 165, 233, 0.15) 0%, transparent 70%)', filter: 'blur(80px)', pointerEvents: 'none', willChange: 'transform', opacity: 0, transform: 'translate(-50%, -50%)' }} />
            <div ref={cardRef} style={{ maxWidth: '420px', width: '100%', margin: '0 var(--space-4)', position: 'relative', zIndex: 1 }}>
                <div style={{ backgroundColor: 'rgba(17, 17, 17, 0.7)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-12)', backdropFilter: 'blur(20px)', boxShadow: 'var(--shadow-xl)' }}>
                    <div ref={logoRef} style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-8)' }}>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ position: 'absolute', width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.2), rgba(139, 92, 246, 0.2))', filter: 'blur(20px)' }} />
                            <div style={{ position: 'relative', width: '64px', height: '64px', borderRadius: 'var(--radius-xl)', background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-glow-blue)' }}>
                                <BotIcon size={32} color="white" />
                            </div>
                        </div>
                    </div>
                    <div ref={headerRef} style={{ textAlign: 'center', marginBottom: 'var(--space-10)' }}>
                        <h1 style={{ fontSize: 'var(--text-4xl)', fontWeight: 'var(--font-bold)', marginBottom: 'var(--space-3)', background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Asistente Cloution</h1>
                        <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>Tu asistente personal impulsado por IA</p>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
                            <SparklesIcon size={14} />
                            <span>Multi-modelo • RAG • Notion • Gmail</span>
                        </div>
                    </div>
                    <button 
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
                            overflow: 'hidden' 
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                            e.currentTarget.style.borderColor = 'var(--border-focus)';
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.2)';
                            
                            const glint = e.currentTarget.querySelector('.glint-span');
                            if (glint) {
                                gsap.fromTo(glint, 
                                { xPercent: -150 }, 
                                { xPercent: 600, duration: 1.2, ease: 'power1.inOut' }
                                );
                            }
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--bg-elevated)';
                            e.currentTarget.style.borderColor = 'var(--border-primary)';
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = 'none';
                        }}
                    >
                        <span
                            className="glint-span"
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '30%',
                                height: '100%',
                                background: 'linear-gradient(to right, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.4) 50%, rgba(255, 255, 255, 0) 100%)',
                                transform: 'skewX(-25deg) translateX(-150%)',
                                pointerEvents: 'none',
                            }}
                        />
                        <GoogleIcon size={20} />
                        Iniciar sesión con Google
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', margin: 'var(--space-8) 0' }}>
                        <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-primary)' }} />
                        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>¿Por qué Google?</span>
                        <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-primary)' }} />
                    </div>
                    <div ref={featuresRef} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                        {[{ text: 'Acceso a Gmail y Calendar', color: 'var(--accent-blue)' }, { text: 'Sincronización automática de datos', color: 'var(--accent-purple)' }, { text: 'Login seguro y sin contraseñas', color: 'var(--accent-green)' }].map((feature, index) => (
                            <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: feature.color, boxShadow: `0 0 8px ${feature.color}` }} />
                                {feature.text}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
}


// --- Orchestrator Component ---
export default function LoginPage() {
  const [loaderState, setLoaderState] = useState<'loading' | 'transitioning' | 'finished'>('loading');
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  // Prevent body scroll while this page is mounted
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []); // Runs only once on mount and unmount

  // Redirect if user is already logged in
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        router.replace('/');
      }
    });
    return () => subscription?.unsubscribe();
  }, [supabase, router]);
  
  // 1. Llamado por Loader cuando sus Fases 1-3 terminan
  const handleLoaderSequenceComplete = () => {
    setLoaderState('transitioning');
  };

  const handleTransitionComplete = () => {
    setLoaderState('finished');
  };

  return (
    <>
      <Head>
        <title>Cloution AI - Login</title>
      </Head>

      {(loaderState === 'loading' || loaderState === 'transitioning') && (
        <Loader 
          onSequenceComplete={handleLoaderSequenceComplete} 
          isTransitioning={loaderState === 'transitioning'}
          onTransitionComplete={handleTransitionComplete}
        />
      )}

      {(loaderState === 'transitioning' || loaderState === 'finished') && (
        <LoginUI 
          isTransitioning={loaderState === 'transitioning'} 
        />
      )}
    </>
  );
}