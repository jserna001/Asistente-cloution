'use client';

import { useConnectionStatus } from '../hooks/useConnectionStatus';
import { AlertIcon, CheckCircleIcon } from './Icons';

interface ConnectionStatusIndicatorProps {
  position?: 'top-right' | 'top-left' | 'inline';
}

export function ConnectionStatusIndicator({ position = 'top-right' }: ConnectionStatusIndicatorProps) {
  const { status, isReconnecting, showIndicator, effectiveType, rtt } = useConnectionStatus();

  // No mostrar si está todo bien
  if (!showIndicator && !isReconnecting) {
    return null;
  }

  const getStatusConfig = () => {
    if (isReconnecting) {
      return {
        color: '#F59E0B', // Amarillo
        bgColor: 'rgba(245, 158, 11, 0.1)',
        borderColor: 'rgba(245, 158, 11, 0.3)',
        icon: <AlertIcon size={16} />,
        text: 'Reconectando...',
        pulse: true,
      };
    }

    switch (status) {
      case 'offline':
        return {
          color: '#EF4444', // Rojo
          bgColor: 'rgba(239, 68, 68, 0.1)',
          borderColor: 'rgba(239, 68, 68, 0.3)',
          icon: <AlertIcon size={16} />,
          text: 'Sin conexión',
          pulse: false,
        };
      case 'slow':
        return {
          color: '#F59E0B', // Amarillo
          bgColor: 'rgba(245, 158, 11, 0.1)',
          borderColor: 'rgba(245, 158, 11, 0.3)',
          icon: <AlertIcon size={16} />,
          text: `Conexión lenta${effectiveType ? ` (${effectiveType})` : ''}${rtt ? ` ${rtt}ms` : ''}`,
          pulse: false,
        };
      case 'online':
      default:
        return {
          color: '#10B981', // Verde
          bgColor: 'rgba(16, 185, 129, 0.1)',
          borderColor: 'rgba(16, 185, 129, 0.3)',
          icon: <CheckCircleIcon size={16} />,
          text: 'Conectado',
          pulse: false,
        };
    }
  };

  const config = getStatusConfig();

  const positionStyles = {
    'top-right': {
      position: 'fixed' as const,
      top: 'var(--space-4)',
      right: 'var(--space-4)',
      zIndex: 1000,
    },
    'top-left': {
      position: 'fixed' as const,
      top: 'var(--space-4)',
      left: 'var(--space-4)',
      zIndex: 1000,
    },
    'inline': {
      position: 'relative' as const,
    },
  };

  return (
    <div
      style={{
        ...positionStyles[position],
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        padding: 'var(--space-2) var(--space-3)',
        borderRadius: 'var(--radius-md)',
        backgroundColor: config.bgColor,
        border: `1px solid ${config.borderColor}`,
        color: config.color,
        fontSize: 'var(--text-sm)',
        fontWeight: 'var(--font-medium)',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        animation: config.pulse ? 'pulse 2s infinite' : 'slideDown 0.3s ease',
      }}
    >
      <div style={{
        display: 'flex',
        animation: config.pulse ? 'spin 1s linear infinite' : undefined,
      }}>
        {config.icon}
      </div>
      <span>{config.text}</span>
    </div>
  );
}

// Badge simple para header (más discreto)
export function ConnectionBadge() {
  const { status, isReconnecting, showIndicator } = useConnectionStatus();

  // Solo mostrar si hay problemas
  if (!showIndicator && !isReconnecting) {
    return null;
  }

  const getBadgeColor = () => {
    if (isReconnecting) return '#F59E0B';
    if (status === 'offline') return '#EF4444';
    if (status === 'slow') return '#F59E0B';
    return '#10B981';
  };

  const getBadgeText = () => {
    if (isReconnecting) return '●';
    if (status === 'offline') return '○';
    if (status === 'slow') return '◐';
    return '●';
  };

  return (
    <div
      style={{
        fontSize: 'var(--text-xl)',
        color: getBadgeColor(),
        animation: isReconnecting ? 'pulse 2s infinite' : undefined,
        lineHeight: 1,
      }}
      title={isReconnecting ? 'Reconectando...' : status === 'offline' ? 'Sin conexión' : 'Conexión lenta'}
    >
      {getBadgeText()}
    </div>
  );
}
