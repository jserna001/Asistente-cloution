import { useRef } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import styles from './Loader.module.css';

// Registrar el plugin de useGSAP
gsap.registerPlugin(useGSAP);

/**
 * Componente Loader con la animación completa "cloution AI"
 * Acepta una prop `onComplete` que es una función a llamar
 * cuando la animación de salida termina.
 */
export default function Loader({ onComplete }: { onComplete?: () => void }) {
  const container = useRef(null);

  // Hook useGSAP para gestionar la creación y limpieza de la animación
  useGSAP(() => {
    
    // Crear la línea de tiempo principal
    const tl = gsap.timeline({
      // Llamar a la función onComplete cuando la timeline termine
      onComplete: () => {
        if (onComplete) {
          onComplete();
        }
      }
    });

    // --- FASE 1: FORMACIÓN DE "AI" ---

    // Línea Izquierda de 'A'
    tl.from(".a-line-1", {
      autoAlpha: 0,       // Opacidad y visibilidad
      xPercent: -100,     // Posición inicial (fuera a la izquierda)
      yPercent: -100,     // Posición inicial (fuera arriba)
      filter: 'blur(8px)',// Efecto de estela
      duration: 0.8,
      ease: 'power3.out'
    }, 0.2); // Empezar a los 0.2s

    // Línea Derecha de 'A'
    tl.from(".a-line-2", {
      autoAlpha: 0,
      xPercent: 100,      // Posición inicial (fuera a la derecha)
      yPercent: -100,     // Posición inicial (fuera arriba)
      filter: 'blur(8px)',
      duration: 0.8,
      ease: 'power3.out'
    }, "<+0.2"); // 0.2s después de que empiece la línea 1

    // Letra 'I'
    tl.from(".i-line", {
      autoAlpha: 0,
      yPercent: 150,      // Posición inicial (fuera abajo)
      filter: 'blur(8px)',
      duration: 0.8,
      ease: 'power3.out'
    }, "<"); // Al mismo tiempo que la línea 2 de 'A'

    // --- FASE 2: PAUSA ---
    // La pausa se logra con el parámetro de delay (+=0.5) en la siguiente animación

    // --- FASE 3: REVELACIÓN DE "cloution" ---

    // Mover el grupo "AI" a la derecha
    tl.to(".ai-group", {
      x: 140, // Valor de desplazamiento (ajustar según sea necesario)
      duration: 1.2,
      ease: "expo.inOut"
    }, "+=0.5"); // Pausa de 0.5s después de que "AI" se forme

    // Aparecer "cloution" desde la izquierda
    tl.from(".cloution-text", {
      autoAlpha: 0,
      x: -30, // Viene desde 30px a la izquierda de su posición final
      duration: 0.9,
      ease: "expo.out"
    }, "<+0.3"); // 0.3s después de que el grupo "AI" empiece a moverse

    // --- FASE 4: SALIDA ---

    // Fade-out del contenedor completo
    tl.to(container.current, {
      autoAlpha: 0,
      delay: 1.0, // Pausa de 1s mostrando el logo "cloution AI" completo
      duration: 0.5
    });

  }, { scope: container }); // Alcance del hook para los selectores

  return (
    <div className={styles.loaderContainer} ref={container}>
      <svg
        className={styles.logoSvg}
        viewBox="-180 0 360 100" // viewBox ajustado para centrar y dar espacio
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Texto "cloution" - GSAP lo animará */}
        <text
          className={`${styles.logoText} cloution-text`}
          x="-170" // Posición final (relativa al viewBox)
          y="75"
        >
          Cloution
        </text>

        {/* Grupo "AI" - para moverlo como un solo bloque */}
        <g className="ai-group">
          {/* 'A' */}
          <path className="a-line-1" d="M0 100 L30 0" />
          <path className="a-line-2" d="M60 100 L30 0" />
          {/* 'I' */}
          <path className="i-line" d="M80 0 L80 100" />
        </g>
      </svg>
    </div>
  );
}
