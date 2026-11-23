'use client';

import React, { useRef, useEffect } from 'react';
import { initGSAP } from './gsapConfig';

export type GSAPAnimationType =
  | 'fade-up'
  | 'fade-down'
  | 'fade-left'
  | 'fade-right'
  | 'zoom-in'
  | 'stagger-children'
  | 'parallax';

export interface GSAPScrollTriggerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  animation?: GSAPAnimationType;
  duration?: number;
  delay?: number;
  stagger?: number;
  distance?: number;
  start?: string; // e.g. "top 85%"
  scrub?: boolean | number;
  className?: string;
}

/**
 * React Bits GSAPScrollTrigger
 * Wraps elements and orchestrates GSAP ScrollTrigger animations with professional physics easing.
 */
export function GSAPScrollTrigger({
  children,
  animation = 'fade-up',
  duration = 0.85,
  delay = 0,
  stagger = 0.08,
  distance = 36,
  start = 'top 88%',
  scrub = false,
  className = '',
  ...rest
}: GSAPScrollTriggerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const { gsap, ScrollTrigger } = initGSAP();

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const el = containerRef.current;
    let tween: gsap.core.Tween | null = null;

    if (animation === 'stagger-children') {
      const childrenNodes = el.children;
      if (childrenNodes.length) {
        gsap.set(childrenNodes, {
          opacity: 0,
          y: distance,
        });

        tween = gsap.to(childrenNodes, {
          opacity: 1,
          y: 0,
          duration,
          delay,
          stagger,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: el,
            start,
            once: !scrub,
            scrub: scrub ? 1 : false,
          },
        });
      }
    } else if (animation === 'parallax') {
      tween = gsap.to(el, {
        y: -distance * 2,
        ease: 'none',
        scrollTrigger: {
          trigger: el,
          start: 'top bottom',
          end: 'bottom top',
          scrub: typeof scrub === 'number' ? scrub : 1,
        },
      });
    } else {
      let fromVars: gsap.TweenVars = { opacity: 0 };
      switch (animation) {
        case 'fade-up':
          fromVars.y = distance;
          break;
        case 'fade-down':
          fromVars.y = -distance;
          break;
        case 'fade-left':
          fromVars.x = -distance;
          break;
        case 'fade-right':
          fromVars.x = distance;
          break;
        case 'zoom-in':
          fromVars.scale = 0.94;
          fromVars.y = distance / 2;
          break;
      }

      gsap.set(el, fromVars);

      tween = gsap.to(el, {
        opacity: 1,
        x: 0,
        y: 0,
        scale: 1,
        duration,
        delay,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: el,
          start,
          once: !scrub,
          scrub: scrub ? 1 : false,
        },
      });
    }

    return () => {
      if (tween) tween.kill();
    };
  }, [animation, duration, delay, stagger, distance, start, scrub]);

  return (
    <div ref={containerRef} className={`will-change-transform ${className}`} {...rest}>
      {children}
    </div>
  );
}

export default GSAPScrollTrigger;
