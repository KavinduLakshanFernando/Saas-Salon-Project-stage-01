'use client';

import React, { useRef } from 'react';
import { initGSAP } from './gsapConfig';

export interface MagnetProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  strength?: number; // strength factor (e.g. 0.3)
  className?: string;
  active?: boolean;
}

/**
 * React Bits Magnet powered by GSAP
 * Pulls elements smoothly toward the cursor on hover with elastic spring physics.
 */
export function Magnet({
  children,
  strength = 0.25,
  className = '',
  active = true,
  ...rest
}: MagnetProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!active || !containerRef.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const { gsap } = initGSAP();
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const deltaX = (e.clientX - centerX) * strength;
    const deltaY = (e.clientY - centerY) * strength;

    gsap.to(containerRef.current, {
      x: deltaX,
      y: deltaY,
      duration: 0.3,
      ease: 'power2.out',
    });
  };

  const handleMouseLeave = () => {
    if (!containerRef.current) return;
    const { gsap } = initGSAP();

    gsap.to(containerRef.current, {
      x: 0,
      y: 0,
      duration: 0.6,
      ease: 'elastic.out(1.1, 0.4)',
    });
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`inline-block will-change-transform ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

export default Magnet;
