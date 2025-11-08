import { useRef } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import styles from './Loader.module.css';

gsap.registerPlugin(useGSAP);

export default function Loader({ 
  onSequenceComplete, 
  isTransitioning, 
  onTransitionComplete 
}: { 
  onSequenceComplete?: () => void; 
  isTransitioning?: boolean; 
  onTransitionComplete?: () => void; 
}) {
  const container = useRef(null);

  // --- 1. LÍNEA DE TIEMPO PRINCIPAL (FASES 1-3) ---
  useGSAP(() => {
    
    const tl = gsap.timeline({
      onComplete: () => {
        if (onSequenceComplete) {
          onSequenceComplete(); // Avisa al index.js
        }
      }
    });

    // FASE 1: Formación (con blur)
    tl.from(".a-line-1", { autoAlpha: 0, xPercent: -100, yPercent: -100, filter: 'blur(8px)', duration: 0.8, ease: 'power3.out' }, 0.2);
    tl.from(".a-line-2", { autoAlpha: 0, xPercent: 100, yPercent: -100, filter: 'blur(8px)', duration: 0.8, ease: 'power3.out' }, "<+0.2");
    tl.from(".i-line", { autoAlpha: 0, yPercent: 150, filter: 'blur(8px)', duration: 0.8, ease: 'power3.out' }, "<");

    // FASE 3: Revelación (incluye Pausa de Fase 2 de 0.5s)
    tl.to(".ai-group", { x: 140, duration: 1.2, ease: "expo.inOut" }, "+=0.5"); 
    tl.from(".cloution-text", { autoAlpha: 0, x: -30, duration: 0.9, ease: "expo.out" }, "<+0.3");

    // Pausa final con logo completo
    tl.to(container.current, { delay: 1.0 });

  }, { scope: container });

  // --- 2. ANIMACIÓN DE SALIDA (TRANSICIÓN) ---
  useGSAP(() => {
    if (isTransitioning) {
      gsap.to(container.current, {
        scale: 4,
        filter: 'blur(10px)',
        autoAlpha: 0,
        duration: 1.0,
        ease: 'power2.in',
        onComplete: () => {
          if (onTransitionComplete) {
            onTransitionComplete(); // Avisa a index.js que terminó de salir
          }
        }
      });
    }
  }, { dependencies: [isTransitioning, onTransitionComplete] });

  return (
    <div 
      className={`${styles.loaderContainer} ${isTransitioning ? styles.transitioning : ''}`} 
      ref={container}
    >
      <svg
        className={styles.logoSvg}
        viewBox="-180 0 360 100"
        preserveAspectRatio="xMidYMid meet"
      >
        <text className={`${styles.logoText} cloution-text`} x="-170" y="75">
          cloution
        </text>
        <g className="ai-group">
          <path className="a-line-1" d="M0 100 L30 0" />
          <path className="a-line-2" d="M60 100 L30 0" />
          <path className="i-line" d="M80 0 L80 100" />
        </g>
      </svg>
    </div>
  );
}
