'use client';

import { createSupabaseBrowserClient } from '../../lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

// --- Iconos y Logo ---
const AppLogo = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#E5E5E7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '12px' }}>
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

export default function LoginPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const cardRef = useRef(null);

  // Animación de entrada
  useEffect(() => {
    gsap.from(cardRef.current, {
      duration: 0.8,
      opacity: 0,
      y: 50,
      scale: 0.95,
      ease: 'power3.out'
    });
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

  const styles = {
    page: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      color: '#E5E5E7',
      background: 'linear-gradient(135deg, #1a1a1a 25%, #121212 25%, #121212 50%, #1a1a1a 50%, #1a1a1a 75%, #121212 75%, #121212 100%)',
      backgroundSize: '80px 80px',
      overflow: 'hidden'
    } as React.CSSProperties,
    card: {
      padding: '48px',
      borderRadius: '24px',
      textAlign: 'center',
      backgroundColor: 'rgba(28, 28, 30, 0.75)',
      backdropFilter: 'blur(20px) saturate(180%)',
      border: '1px solid rgba(255, 255, 255, 0.125)',
      boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
      maxWidth: '400px',
      width: '90%'
    } as React.CSSProperties,
    logoContainer: {
      marginBottom: '24px'
    },
    title: {
      fontSize: '2rem',
      fontWeight: 600,
      marginBottom: '8px'
    },
    subtitle: {
      fontSize: '1rem',
      color: '#8E8E93',
      marginBottom: '32px'
    },
    button: {
      fontSize: '1rem',
      fontWeight: 500,
      padding: '12px 24px',
      borderRadius: '12px',
      border: 'none',
      backgroundColor: '#fff',
      color: '#121212',
      cursor: 'pointer',
      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
    } as React.CSSProperties,
  };

  return (
    <div style={styles.page}>
      <div ref={cardRef} style={styles.card}>
        <div style={styles.logoContainer}>
          <AppLogo />
        </div>
        <h1 style={styles.title}>Asistente Personal</h1>
        <p style={styles.subtitle}>Inicia sesión para continuar</p>
        <button 
          onClick={handleLoginWithGoogle} 
          style={styles.button}
          onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0px)'}
        >
          <GoogleIcon />
          Iniciar sesión con Google
        </button>
      </div>
    </div>
  );
}