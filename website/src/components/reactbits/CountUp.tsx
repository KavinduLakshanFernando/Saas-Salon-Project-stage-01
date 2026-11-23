'use client';

import React, { useRef, useEffect, useState } from 'react';
import { initGSAP } from './gsapConfig';

export interface CountUpProps extends React.HTMLAttributes<HTMLSpanElement> {
  to: number;
  from?: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

/**
 * React Bits CountUp powered by GSAP ScrollTrigger
 * Smoothly interpolates numeric values when scrolled into view.
 */
export function CountUp({
  to,
  from = 0,
  duration = 1.8,
  decimals = 0,
  prefix = '',
  suffix = '',
  className = '',
  ...rest
}: CountUpProps) {
  const spanRef = useRef<HTMLSpanElement>(null);
  const [displayValue, setDisplayValue] = useState(from.toFixed(decimals));

  useEffect(() => {
    if (!spanRef.current) return;
    const { gsap, ScrollTrigger } = initGSAP();

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplayValue(to.toFixed(decimals));
      return;
    }

    const obj = { val: from };

    const tween = gsap.to(obj, {
      val: to,
      duration,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: spanRef.current,
        start: 'top 90%',
        once: true,
      },
      onUpdate: () => {
        setDisplayValue(obj.val.toFixed(decimals));
      },
      onComplete: () => {
        setDisplayValue(to.toFixed(decimals));
      },
    });

    return () => {
      tween.kill();
    };
  }, [to, from, duration, decimals]);

  return (
    <span ref={spanRef} className={`inline-block tabular-nums ${className}`} {...rest}>
      {prefix}
      {displayValue}
      {suffix}
    </span>
  );
}

export default CountUp;
