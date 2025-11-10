/**
 * NotificationToast Component
 *
 * Sistema de notificaciones toast con animaciones contextuales
 */

'use client';

import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { CheckCircleIcon, AlertCircle, Info, X } from 'lucide-react';
import { useNotifications, getNotificationAnimation } from '@/lib/animations';
import type { Notification, NotificationType } from '@/lib/animations';

gsap.registerPlugin(useGSAP);

// Icono por tipo de notificación
const NotificationIcon: React.FC<{ type: NotificationType }> = ({ type }) => {
  const iconProps = { size: 20, strokeWidth: 2.5 };

  switch (type) {
    case 'success':
      return <CheckCircleIcon {...iconProps} />;
    case 'error':
      return <AlertCircle {...iconProps} />;
    case 'warning':
      return <AlertCircle {...iconProps} />;
    case 'info':
      return <Info {...iconProps} />;
    default:
      return <Info {...iconProps} />;
  }
};

// Componente individual de toast
const Toast: React.FC<{
  notification: Notification;
  onDismiss: (id: string) => void;
}> = ({ notification, onDismiss }) => {
  const toastRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const { type, message, duration, id } = notification;

  const animConfig = getNotificationAnimation(type);

  // Animación de entrada
  useGSAP(() => {
    if (!toastRef.current) return;

    const tl = gsap.timeline();

    // Entrada desde la derecha con slide + fade
    tl.from(toastRef.current, {
      x: 400,
      opacity: 0,
      duration: 0.4,
      ease: 'back.out(1.7)',
    });

    // Animación del icono según el tipo
    const icon = toastRef.current.querySelector('.toast-icon');
    if (icon) {
      if (type === 'success') {
        tl.from(
          icon,
          {
            scale: 0,
            rotation: -180,
            duration: 0.5,
            ease: 'back.out(2)',
          },
          '-=0.2'
        );
      } else if (type === 'error' || type === 'warning') {
        tl.from(
          icon,
          {
            scale: 0,
            duration: 0.3,
            ease: 'elastic.out(1, 0.5)',
          },
          '-=0.2'
        );
        // Shake para errores
        if (type === 'error') {
          tl.to(icon, {
            x: -5,
            duration: 0.1,
            yoyo: true,
            repeat: 3,
          });
        }
      } else {
        tl.from(
          icon,
          {
            scale: 0,
            duration: 0.3,
            ease: 'back.out(1.7)',
          },
          '-=0.2'
        );
      }
    }

    // Animación de la barra de progreso si tiene duración
    if (duration && progressRef.current) {
      tl.to(
        progressRef.current,
        {
          scaleX: 0,
          duration: duration / 1000,
          ease: 'none',
        },
        '-=0.3'
      );
    }

    return () => {
      tl.kill();
    };
  }, [type, duration]);

  // Auto-dismiss con animación de salida
  const handleDismiss = () => {
    if (!toastRef.current) return;

    gsap.to(toastRef.current, {
      x: 400,
      opacity: 0,
      duration: 0.3,
      ease: 'back.in(1.7)',
      onComplete: () => {
        onDismiss(id);
      },
    });
  };

  // Colores por tipo
  const getColors = () => {
    switch (type) {
      case 'success':
        return {
          bg: '#10b98115',
          border: '#10b981',
          text: '#10b981',
          progress: '#10b981',
        };
      case 'error':
        return {
          bg: '#ef444415',
          border: '#ef4444',
          text: '#ef4444',
          progress: '#ef4444',
        };
      case 'warning':
        return {
          bg: '#f59e0b15',
          border: '#f59e0b',
          text: '#f59e0b',
          progress: '#f59e0b',
        };
      case 'info':
        return {
          bg: '#3b82f615',
          border: '#3b82f6',
          text: '#3b82f6',
          progress: '#3b82f6',
        };
      default:
        return {
          bg: '#6b728015',
          border: '#6b7280',
          text: '#6b7280',
          progress: '#6b7280',
        };
    }
  };

  const colors = getColors();

  return (
    <div
      ref={toastRef}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 'var(--space-3)',
        padding: 'var(--space-4)',
        backgroundColor: 'var(--bg-primary)',
        border: `2px solid ${colors.border}`,
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
        minWidth: '320px',
        maxWidth: '420px',
        overflow: 'hidden',
        backdropFilter: 'blur(10px)',
      }}
    >
      {/* Background overlay */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: colors.bg,
          pointerEvents: 'none',
        }}
      />

      {/* Icono */}
      <div
        className="toast-icon"
        style={{
          position: 'relative',
          display: 'flex',
          color: colors.text,
          flexShrink: 0,
        }}
      >
        <NotificationIcon type={type} />
      </div>

      {/* Contenido */}
      <div
        style={{
          position: 'relative',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-1)',
        }}
      >
        <div
          style={{
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--font-medium)',
            color: 'var(--text-primary)',
            lineHeight: 1.4,
          }}
        >
          {message}
        </div>
      </div>

      {/* Botón de cerrar */}
      <button
        onClick={handleDismiss}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--space-1)',
          border: 'none',
          background: 'transparent',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          borderRadius: 'var(--radius-sm)',
          transition: 'all 0.2s',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = colors.bg;
          e.currentTarget.style.color = colors.text;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.color = 'var(--text-secondary)';
        }}
      >
        <X size={16} />
      </button>

      {/* Barra de progreso */}
      {duration && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '3px',
            backgroundColor: `${colors.progress}30`,
            overflow: 'hidden',
          }}
        >
          <div
            ref={progressRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              height: '100%',
              width: '100%',
              backgroundColor: colors.progress,
              transformOrigin: 'left center',
            }}
          />
        </div>
      )}
    </div>
  );
};

// Contenedor de toasts
export const NotificationToast: React.FC = () => {
  const { notifications, dismissNotification } = useNotifications();

  return (
    <div
      style={{
        position: 'fixed',
        top: 'var(--space-6)',
        right: 'var(--space-6)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
        pointerEvents: 'none',
      }}
    >
      {notifications.map((notification) => (
        <div key={notification.id} style={{ pointerEvents: 'auto' }}>
          <Toast notification={notification} onDismiss={dismissNotification} />
        </div>
      ))}
    </div>
  );
};
