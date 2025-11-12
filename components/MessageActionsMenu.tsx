'use client';

import { useState, useRef, useEffect } from 'react';
import { MoreIcon, CopyIcon, RefreshIcon, CheckIcon } from './Icons';

interface MessageActionsMenuProps {
  messageText: string;
  onRegenerate: () => void;
  onFeedback: () => void;
}

export function MessageActionsMenu({ messageText, onRegenerate, onFeedback }: MessageActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Cerrar menú al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(messageText);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      setIsOpen(false);
    }, 1500);
  };

  const handleRegenerate = () => {
    onRegenerate();
    setIsOpen(false);
  };

  const handleFeedback = () => {
    onFeedback();
    setIsOpen(false);
  };

  return (
    <div ref={menuRef} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Botón para abrir menú */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="icon-hover-scale"
        style={{
          padding: 'var(--space-1) var(--space-2)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-primary)',
          backgroundColor: isOpen ? 'var(--bg-tertiary)' : 'transparent',
          color: 'var(--text-secondary)',
          fontSize: 'var(--text-xs)',
          cursor: 'pointer',
          transition: 'all var(--transition-fast)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-1)',
        }}
        title="Más acciones"
      >
        <MoreIcon size={14} />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + var(--space-1))',
            right: 0,
            minWidth: '180px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-primary)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            padding: 'var(--space-1)',
            zIndex: 100,
            animation: 'slideDown 0.2s ease',
          }}
        >
          {/* Copy */}
          <button
            onClick={handleCopy}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-2) var(--space-3)',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              backgroundColor: 'transparent',
              color: 'var(--text-primary)',
              fontSize: 'var(--text-sm)',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
              textAlign: 'left',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
            <span>{copied ? 'Copiado!' : 'Copiar respuesta'}</span>
          </button>

          {/* Regenerate */}
          <button
            onClick={handleRegenerate}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-2) var(--space-3)',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              backgroundColor: 'transparent',
              color: 'var(--text-primary)',
              fontSize: 'var(--text-sm)',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
              textAlign: 'left',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <RefreshIcon size={16} />
            <span>Regenerar respuesta</span>
          </button>

          {/* Divider */}
          <div
            style={{
              height: '1px',
              backgroundColor: 'var(--border-primary)',
              margin: 'var(--space-1) 0',
            }}
          />

          {/* Feedback */}
          <button
            onClick={handleFeedback}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-2) var(--space-3)',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              backgroundColor: 'transparent',
              color: 'var(--text-primary)',
              fontSize: 'var(--text-sm)',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
              textAlign: 'left',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <span style={{ fontSize: '16px' }}>👍</span>
            <span>Enviar feedback</span>
          </button>
        </div>
      )}
    </div>
  );
}
