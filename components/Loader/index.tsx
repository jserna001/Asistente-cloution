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
  
  // --- 1. LÍNEA DE TIEMPO PRINCIPAL (CON LOGICA RESPONSIVE) ---
  useGSAP(() => {
    
    // Configura matchMedia
    const mm = gsap.matchMedia(container);

    // --- VERSIÓN ESCRITORIO (HORIZONTAL) ---
    mm.add("(min-width: 769px)", () => {
      // 1. Pre-posiciona los elementos para el layout de escritorio
      gsap.set(".ai-group", { x: 0 });
      gsap.set(".cloution-text", { x: -170, y: 75, textAnchor: 'start' });

      // 2. Crea la línea de tiempo de escritorio
      const tl_desktop = gsap.timeline({
        onComplete: () => onSequenceComplete && onSequenceComplete()
      });

      // Fase 1: Formación
      tl_desktop.from(".a-line-1", { autoAlpha: 0, xPercent: -100, yPercent: -100, filter: 'blur(8px)', duration: 0.8, ease: 'power3.out' }, 0.2);
      tl_desktop.from(".a-line-2", { autoAlpha: 0, xPercent: 100, yPercent: -100, filter: 'blur(8px)', duration: 0.8, ease: 'power3.out' }, "<+0.2");
      tl_desktop.from(".i-line", { autoAlpha: 0, yPercent: 150, filter: 'blur(8px)', duration: 0.8, ease: 'power3.out' }, "<");

      // Fase 3: Revelación (Horizontal)
      tl_desktop.to(".ai-group", { x: 140, duration: 1.2, ease: "expo.inOut" }, "+=0.5"); // Pausa de 0.5s
      tl_desktop.from(".cloution-text", { autoAlpha: 0, x: -30, duration: 0.9, ease: "expo.out" }, "<+0.3");

      // Pausa final
      tl_desktop.to(container.current, { delay: 1.0 });
    });

    // --- VERSIÓN MÓVIL (VERTICAL/APILADO) ---
    mm.add("(max-width: 768px)", () => {
      // 1. Pre-posiciona los elementos para el layout móvil
      gsap.set(".ai-group", { x: 30 }); // Centra el "AI"
      gsap.set(".cloution-text", { x: 40, y: 160, textAnchor: 'middle' }); // Centra "cloution" debajo

      // 2. Crea la línea de tiempo móvil
      const tl_mobile = gsap.timeline({
        onComplete: () => onSequenceComplete && onSequenceComplete()
      });

      // Fase 1: Formación (Idéntica)
      tl_mobile.from(".a-line-1", { autoAlpha: 0, xPercent: -100, yPercent: -100, filter: 'blur(8px)', duration: 0.8, ease: 'power3.out' }, 0.2);
      tl_mobile.from(".a-line-2", { autoAlpha: 0, xPercent: 100, yPercent: -100, filter: 'blur(8px)', duration: 0.8, ease: 'power3.out' }, "<+0.2");
      tl_mobile.from(".i-line", { autoAlpha: 0, yPercent: 150, filter: 'blur(8px)', duration: 0.8, ease: 'power3.out' }, "<");

      // Fase 3: Revelación (Vertical)
      tl_mobile.to(".ai-group", { y: -60, duration: 1.2, ease: "expo.inOut" }, "+=0.5"); // Mueve "AI" ARRIBA
      tl_mobile.from(".cloution-text", { autoAlpha: 0, y: "+=100", duration: 0.9, ease: "expo.out" }, "<+0.3"); // "cloution" aparece DESDE ABAJO

      // Pausa final
      tl_mobile.to(container.current, { delay: 1.0 });
    });

  }, { scope: container });

  // --- 2. ANIMACIÓN DE SALIDA (TRANSICIÓN) ---
  // Esta animación funciona igual en móvil y escritorio
  useGSAP(() => {
    if (isTransitioning) {
      gsap.to(container.current, {
        scale: 4,
        filter: 'blur(10px)',
        autoAlpha: 0,
        duration: 1.0,
        ease: 'power2.in',
        onComplete: () => onTransitionComplete && onTransitionComplete()
      });
    }
  }, { dependencies: [isTransitioning, onTransitionComplete] });

  return (
    <div 
      className={`${styles.loaderContainer} ${isTransitioning ? styles.transitioning : ''}`} 
      ref={container}
    >
      {/* El viewBox se ha hecho más alto (200) para acomodar el layout vertical móvil */}
      <svg
        className={styles.logoSvg}
        viewBox="-180 0 360 200"
        preserveAspectRatio="xMidYMid meet"
      >
        <text className={`${styles.logoText} cloution-text`}>
          Cloution
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
