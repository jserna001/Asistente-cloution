'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

interface SummaryFeedbackProps {
  summaryId: string;
  onFeedbackSubmitted?: (wasHelpful: boolean) => void;
}

export default function SummaryFeedback({ summaryId, onFeedbackSubmitted }: SummaryFeedbackProps) {
  const [feedback, setFeedback] = useState<{ was_helpful: boolean | null; rating: number | null } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDetailedFeedback, setShowDetailedFeedback] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [feedbackText, setFeedbackText] = useState('');
  const supabase = createClientComponentClient();

  const feedbackTags = [
    'Tareas importantes omitidas',
    'Información irrelevante',
    'Demasiado largo',
    'Demasiado corto',
    'Tono no adecuado',
    'Faltaron eventos de Calendar',
    'Faltaron correos importantes',
    'Excelente priorización',
    'Links útiles',
    'Sugerencias valiosas'
  ];

  // Cargar feedback existente
  useEffect(() => {
    async function loadFeedback() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`/api/summaries/${summaryId}/feedback`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.feedback) {
          setFeedback(data.feedback);
        }
      }
    }

    loadFeedback();
  }, [summaryId, supabase]);

  const handleQuickFeedback = async (wasHelpful: boolean) => {
    setIsSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('Por favor inicia sesión');
        return;
      }

      const response = await fetch(`/api/summaries/${summaryId}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          was_helpful: wasHelpful
        })
      });

      if (response.ok) {
        const data = await response.json();
        setFeedback(data.feedback);
        onFeedbackSubmitted?.(wasHelpful);

        if (!wasHelpful) {
          setShowDetailedFeedback(true);
        }
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error enviando feedback:', error);
      alert('Error enviando feedback');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDetailedFeedback = async () => {
    setIsSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('Por favor inicia sesión');
        return;
      }

      const response = await fetch(`/api/summaries/${summaryId}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          was_helpful: feedback?.was_helpful,
          feedback_tags: selectedTags,
          feedback_text: feedbackText || null
        })
      });

      if (response.ok) {
        alert('¡Gracias por tu feedback detallado!');
        setShowDetailedFeedback(false);
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error enviando feedback detallado:', error);
      alert('Error enviando feedback');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  return (
    <div className="summary-feedback">
      {/* Botones de feedback rápido */}
      {feedback === null ? (
        <div className="quick-feedback">
          <p className="feedback-question">¿Te fue útil este resumen?</p>
          <div className="feedback-buttons">
            <button
              onClick={() => handleQuickFeedback(true)}
              disabled={isSubmitting}
              className="btn-helpful"
              title="Útil"
            >
              👍 Sí
            </button>
            <button
              onClick={() => handleQuickFeedback(false)}
              disabled={isSubmitting}
              className="btn-not-helpful"
              title="No útil"
            >
              👎 No
            </button>
          </div>
        </div>
      ) : (
        <div className="feedback-submitted">
          <p>
            {feedback.was_helpful
              ? '✅ Marcaste este resumen como útil'
              : '❌ Marcaste este resumen como no útil'}
          </p>
          {!showDetailedFeedback && feedback.was_helpful === false && (
            <button
              onClick={() => setShowDetailedFeedback(true)}
              className="btn-add-details"
            >
              Agregar detalles
            </button>
          )}
        </div>
      )}

      {/* Formulario de feedback detallado */}
      {showDetailedFeedback && (
        <div className="detailed-feedback">
          <h4>¿Qué podemos mejorar?</h4>

          <div className="feedback-tags">
            {feedbackTags.map(tag => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`tag ${selectedTags.includes(tag) ? 'selected' : ''}`}
              >
                {tag}
              </button>
            ))}
          </div>

          <textarea
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder="Comentarios adicionales (opcional)"
            rows={3}
            className="feedback-textarea"
          />

          <div className="detailed-actions">
            <button
              onClick={handleDetailedFeedback}
              disabled={isSubmitting || selectedTags.length === 0}
              className="btn-submit"
            >
              Enviar feedback
            </button>
            <button
              onClick={() => setShowDetailedFeedback(false)}
              className="btn-cancel"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .summary-feedback {
          margin-top: 1.5rem;
          padding: 1rem;
          border-top: 1px solid #e5e7eb;
        }

        .feedback-question {
          margin-bottom: 0.75rem;
          font-size: 0.9rem;
          color: #6b7280;
        }

        .feedback-buttons {
          display: flex;
          gap: 0.75rem;
        }

        .btn-helpful,
        .btn-not-helpful {
          padding: 0.5rem 1rem;
          border: 1px solid #d1d5db;
          border-radius: 0.5rem;
          background: white;
          cursor: pointer;
          font-size: 0.9rem;
          transition: all 0.2s;
        }

        .btn-helpful:hover {
          background: #d1fae5;
          border-color: #10b981;
        }

        .btn-not-helpful:hover {
          background: #fee2e2;
          border-color: #ef4444;
        }

        .btn-helpful:disabled,
        .btn-not-helpful:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .feedback-submitted {
          font-size: 0.9rem;
          color: #6b7280;
        }

        .btn-add-details {
          margin-top: 0.5rem;
          padding: 0.375rem 0.75rem;
          background: #f3f4f6;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          font-size: 0.85rem;
          cursor: pointer;
          transition: background 0.2s;
        }

        .btn-add-details:hover {
          background: #e5e7eb;
        }

        .detailed-feedback {
          margin-top: 1rem;
          padding: 1rem;
          background: #f9fafb;
          border-radius: 0.5rem;
        }

        .detailed-feedback h4 {
          margin-bottom: 0.75rem;
          font-size: 0.95rem;
          font-weight: 600;
        }

        .feedback-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }

        .tag {
          padding: 0.375rem 0.75rem;
          background: white;
          border: 1px solid #d1d5db;
          border-radius: 1rem;
          font-size: 0.85rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .tag:hover {
          border-color: #9ca3af;
        }

        .tag.selected {
          background: #3b82f6;
          color: white;
          border-color: #3b82f6;
        }

        .feedback-textarea {
          width: 100%;
          padding: 0.5rem;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          font-family: inherit;
          font-size: 0.9rem;
          resize: vertical;
        }

        .feedback-textarea:focus {
          outline: none;
          border-color: #3b82f6;
          ring: 2px;
          ring-color: #3b82f680;
        }

        .detailed-actions {
          display: flex;
          gap: 0.75rem;
          margin-top: 1rem;
        }

        .btn-submit {
          padding: 0.5rem 1rem;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 0.375rem;
          font-size: 0.9rem;
          cursor: pointer;
          transition: background 0.2s;
        }

        .btn-submit:hover:not(:disabled) {
          background: #2563eb;
        }

        .btn-submit:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-cancel {
          padding: 0.5rem 1rem;
          background: white;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          font-size: 0.9rem;
          cursor: pointer;
          transition: background 0.2s;
        }

        .btn-cancel:hover {
          background: #f3f4f6;
        }
      `}</style>
    </div>
  );
}
