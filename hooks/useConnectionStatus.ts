'use client';

import { useEffect, useState } from 'react';

export type ConnectionStatus = 'online' | 'offline' | 'slow';

interface ConnectionInfo {
  status: ConnectionStatus;
  effectiveType?: string; // '4g', '3g', '2g', 'slow-2g'
  downlink?: number; // Mbps
  rtt?: number; // Round-trip time en ms
}

export function useConnectionStatus() {
  const [connectionInfo, setConnectionInfo] = useState<ConnectionInfo>({
    status: 'online',
  });
  const [showIndicator, setShowIndicator] = useState(false);

  useEffect(() => {
    // Función para actualizar el estado de conexión
    const updateConnectionStatus = () => {
      const isOnline = navigator.onLine;

      // Obtener información de red si está disponible (solo Chrome/Edge)
      const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;

      let status: ConnectionStatus = isOnline ? 'online' : 'offline';
      let effectiveType = connection?.effectiveType;
      let downlink = connection?.downlink;
      let rtt = connection?.rtt;

      // Detectar conexión lenta
      if (isOnline && connection) {
        if (effectiveType === 'slow-2g' || effectiveType === '2g' || rtt > 1000) {
          status = 'slow';
        }
      }

      setConnectionInfo({
        status,
        effectiveType,
        downlink,
        rtt,
      });

      // Mostrar indicador solo si hay problemas
      setShowIndicator(status !== 'online');

      console.log(`🌐 Connection: ${status}`, connection ? `(${effectiveType}, ${downlink}Mbps, ${rtt}ms RTT)` : '');
    };

    // Actualizar al montar
    updateConnectionStatus();

    // Listeners para cambios de conexión
    window.addEventListener('online', updateConnectionStatus);
    window.addEventListener('offline', updateConnectionStatus);

    // Listener para cambios en la calidad de red (si está disponible)
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (connection) {
      connection.addEventListener('change', updateConnectionStatus);
    }

    // Cleanup
    return () => {
      window.removeEventListener('online', updateConnectionStatus);
      window.removeEventListener('offline', updateConnectionStatus);
      if (connection) {
        connection.removeEventListener('change', updateConnectionStatus);
      }
    };
  }, []);

  // Función para forzar reconexión (para mostrar estado "reconnecting")
  const [isReconnecting, setIsReconnecting] = useState(false);

  const checkConnection = async () => {
    if (!navigator.onLine) {
      return false;
    }

    setIsReconnecting(true);
    setShowIndicator(true);

    try {
      // Hacer un fetch simple al propio dominio para verificar conectividad
      const response = await fetch('/api/health', {
        method: 'HEAD',
        cache: 'no-cache',
      });

      const isConnected = response.ok;
      setIsReconnecting(false);

      if (!isConnected) {
        setConnectionInfo(prev => ({ ...prev, status: 'offline' }));
      }

      return isConnected;
    } catch (error) {
      setIsReconnecting(false);
      setConnectionInfo(prev => ({ ...prev, status: 'offline' }));
      return false;
    }
  };

  return {
    ...connectionInfo,
    isOnline: connectionInfo.status === 'online',
    isOffline: connectionInfo.status === 'offline',
    isSlow: connectionInfo.status === 'slow',
    isReconnecting,
    showIndicator,
    checkConnection,
  };
}
