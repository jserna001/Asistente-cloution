'use client';

import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import Logo from './Logo';
import styles from './Loader.module.css';

const Loader = ({ onComplete }: { onComplete?: () => void }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const aLeftRef = useRef<SVGPathElement>(null);
  const aRightRef = useRef<SVGPathElement>(null);
  const iRef = useRef<SVGPathElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);

  useGSAP(() => {
    const chars = gsap.utils.toArray<HTMLElement>('.char');
    const tl = gsap.timeline({ onComplete: onComplete });

    // Fase 1: Formación de las letras "AI"
    tl.fromTo(aLeftRef.current, 
      { opacity: 0, x: "-100%", y: "-100%", filter: 'blur(5px)' },
      { opacity: 1, x: "0%", y: "0%", filter: 'blur(0px)', duration: 1, ease: 'power3.inOut' }
    )
    .fromTo(aRightRef.current,
      { opacity: 0, x: "100%", y: "-100%", filter: 'blur(5px)' },
      { opacity: 1, x: "0%", y: "0%", filter: 'blur(0px)', duration: 1, ease: 'power3.inOut' },
      "-=0.8"
    )
    .fromTo(iRef.current,
      { opacity: 0, y: "150%", filter: 'blur(5px)' },
      { opacity: 1, y: "0%", filter: 'blur(0px)', duration: 1, ease: 'power3.inOut' },
      "<"
    );

    // Fase 2: Pausa y consolidación
    tl.to({}, { duration: 0.5 });

    // Fase 3: Revelación del nombre completo "cloution AI"
    const cloutionWidth = textRef.current!.offsetWidth;
    const aiWidth = svgRef.current!.offsetWidth;
    const padding = 20; // Espacio entre "cloution" y "AI"
    
    const totalWidth = cloutionWidth + aiWidth + padding;
    
    const cloutionMove = -(totalWidth / 2) + (cloutionWidth / 2);
    const aiMove = (totalWidth / 2) - (aiWidth / 2);

    tl.to(svgRef.current, {
      x: aiMove,
      duration: 1.2,
      ease: 'expo.inOut',
    })
    .to(textRef.current, {
      x: cloutionMove,
      opacity: 1,
      duration: 1.2,
      ease: 'expo.inOut',
    }, "<")
    .from(chars, {
      opacity: 0,
      y: "100%",
      stagger: 0.05,
      duration: 0.5,
      ease: 'power3.out'
    }, "<0.3");

  }, { scope: containerRef });

  return (
    <div className={styles.loaderContainer} ref={containerRef}>
      <div className={styles.logoContainer}>
        <span className={styles.cloutionText} ref={textRef}>
          {'cloution'.split('').map((char, index) => (
            <span className={styles.charWrapper} key={index}>
              <span className={`char ${styles.char}`}>
                {char}
              </span>
            </span>
          ))}
        </span>
        <Logo ref={svgRef} aLeftRef={aLeftRef} aRightRef={aRightRef} iRef={iRef} />
      </div>
    </div>
  );
};

export default Loader;
