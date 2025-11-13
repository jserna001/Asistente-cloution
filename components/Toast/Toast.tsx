'use client';

import { useEffect, useState } from 'react';
import { CheckCircleIcon, AlertIcon, InfoIcon, XIcon } from '../Icons';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number; // milisegundos, default 4000
}

interface ToastProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: ToastProps) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const duration = toast.duration || 4000;
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => {
        onDismiss(toast.id);
      }, 300); // Esperar animación de salida
    }, duration);

    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  const getToastStyle = () => {
    switch (toast.type) {
      case 'success':
        return {
          backgroundColor: 'rgba(34, 197, 94, 0.95)',
          color: 'white',
          icon: <CheckCircleIcon size={20} />,
        };
      case 'error':
        return {
          backgroundColor: 'rgba(239, 68, 68, 0.95)',
          color: 'white',
          icon: <AlertIcon size={20} />,
        };
      case 'warning':
        return {
          backgroundColor: 'rgba(251, 191, 36, 0.95)',
          color: '#1f2937',
          icon: <AlertIcon size={20} />,
        };
      case 'info':
      default:
        return {
          backgroundColor: 'rgba(59, 130, 246, 0.95)',
          color: 'white',
          icon: <InfoIcon size={20} />,
        };
    }
  };

  const style = getToastStyle();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        padding: 'var(--space-3) var(--space-4)',
        borderRadius: 'var(--radius-lg)',
        backgroundColor: style.backgroundColor,
        color: style.color,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        minWidth: '300px',
        maxWidth: '400px',
        animation: isExiting ? 'slideOut 0.3s ease' : 'slideIn 0.3s ease',
        marginBottom: 'var(--space-2)',
      }}
    >
      <div style={{ display: 'flex', flexShrink: 0 }}>
        {style.icon}
      </div>
      <p style={{
        flex: 1,
        margin: 0,
        fontSize: 'var(--text-sm)',
        fontWeight: 'var(--font-medium)',
        lineHeight: 'var(--leading-relaxed)',
      }}>
        {toast.message}
      </p>
      <button
        onClick={() => {
          setIsExiting(true);
          setTimeout(() => onDismiss(toast.id), 300);
        }}
        style={{
          background: 'none',
          border: 'none',
          color: 'inherit',
          cursor: 'pointer',
          padding: 'var(--space-1)',
          display: 'flex',
          opacity: 0.8,
          transition: 'opacity 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '1';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = '0.8';
        }}
      >
        <XIcon size={16} />
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 'var(--space-6)',
        right: 'var(--space-6)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
      }}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
