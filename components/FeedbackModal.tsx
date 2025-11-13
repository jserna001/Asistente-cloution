'use client';

import { useState } from 'react';
import { XIcon } from './Icons';

interface FeedbackModalProps {
  messageText: string;
  onClose: () => void;
  onSubmit: (feedback: { rating: 'positive' | 'negative'; comment: string }) => void;
}

export function FeedbackModal({ messageText, onClose, onSubmit }: FeedbackModalProps) {
  const [rating, setRating] = useState<'positive' | 'negative' | null>(null);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!rating) return;

    setIsSubmitting(true);
    await onSubmit({ rating, comment });
    setIsSubmitting(false);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: 'var(--space-4)',
        animation: 'fadeIn 0.2s ease',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-6)',
          maxWidth: '500px',
          width: '100%',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
          animation: 'slideDown 0.3s ease',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 'var(--space-4)',
          }}
        >
          <h3
            style={{
              fontSize: 'var(--text-lg)',
              fontWeight: 'var(--font-bold)',
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            Feedback sobre la respuesta
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: 'var(--space-1)',
              display: 'flex',
              transition: 'color 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            <XIcon size={20} />
          </button>
        </div>

        {/* Message preview */}
        <div
          style={{
            padding: 'var(--space-3)',
            backgroundColor: 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--space-4)',
            maxHeight: '100px',
            overflowY: 'auto',
          }}
        >
          <p
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--text-secondary)',
              margin: 0,
              whiteSpace: 'pre-wrap',
            }}
          >
            {messageText.substring(0, 200)}
            {messageText.length > 200 ? '...' : ''}
          </p>
        </div>

        {/* Rating */}
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <label
            style={{
              display: 'block',
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--font-medium)',
              color: 'var(--text-primary)',
              marginBottom: 'var(--space-2)',
            }}
          >
            ¿Qué te pareció esta respuesta?
          </label>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button
              onClick={() => setRating('positive')}
              style={{
                flex: 1,
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: `2px solid ${rating === 'positive' ? 'var(--accent-blue)' : 'var(--border-primary)'}`,
                backgroundColor: rating === 'positive' ? 'rgba(14, 165, 233, 0.1)' : 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--font-medium)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-2)',
              }}
            >
              <span style={{ fontSize: '20px' }}>👍</span>
              <span>Útil</span>
            </button>
            <button
              onClick={() => setRating('negative')}
              style={{
                flex: 1,
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: `2px solid ${rating === 'negative' ? 'var(--accent-red)' : 'var(--border-primary)'}`,
                backgroundColor: rating === 'negative' ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--font-medium)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-2)',
              }}
            >
              <span style={{ fontSize: '20px' }}>👎</span>
              <span>No útil</span>
            </button>
          </div>
        </div>

        {/* Comment */}
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <label
            style={{
              display: 'block',
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--font-medium)',
              color: 'var(--text-primary)',
              marginBottom: 'var(--space-2)',
            }}
          >
            Comentarios adicionales (opcional)
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="¿Qué podría mejorar?"
            style={{
              width: '100%',
              padding: 'var(--space-3)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-primary)',
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              fontSize: 'var(--text-sm)',
              outline: 'none',
              resize: 'vertical',
              minHeight: '80px',
              fontFamily: 'inherit',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent-blue)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-primary)';
            }}
          />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-primary)',
              backgroundColor: 'transparent',
              color: 'var(--text-primary)',
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--font-medium)',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!rating || isSubmitting}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              backgroundColor: !rating || isSubmitting ? 'var(--bg-tertiary)' : 'var(--accent-blue)',
              color: 'white',
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--font-semibold)',
              cursor: !rating || isSubmitting ? 'not-allowed' : 'pointer',
              opacity: !rating || isSubmitting ? 0.5 : 1,
              transition: 'all 0.2s',
            }}
          >
            {isSubmitting ? 'Enviando...' : 'Enviar feedback'}
          </button>
        </div>
      </div>
    </div>
  );
}
