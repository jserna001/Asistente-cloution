import { forwardRef } from 'react';
import styles from './Loader.module.css';

interface LogoProps {
  svgRef: React.Ref<SVGSVGElement>;
  aLeftRef: React.Ref<SVGPathElement>;
  aRightRef: React.Ref<SVGPathElement>;
  iRef: React.Ref<SVGPathElement>;
}

const Logo = forwardRef<SVGSVGElement, Omit<LogoProps, 'svgRef'>>(({ aLeftRef, aRightRef, iRef }, ref) => {
  return (
    <svg
      ref={ref}
      className={styles.logoSvg}
      viewBox="0 0 160 100"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g>
        {/* Letra A */}
        <path ref={aLeftRef} d="M 20 90 L 50 10" stroke="white" strokeWidth="10" fill="none" strokeLinecap="round" />
        <path ref={aRightRef} d="M 80 90 L 50 10" stroke="white" strokeWidth="10" fill="none" strokeLinecap="round" />
        {/* Letra I */}
        <path ref={iRef} d="M 110 10 L 110 90" stroke="white" strokeWidth="10" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  );
});

Logo.displayName = 'Logo';

export default Logo;
