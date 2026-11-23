'use client';

import React, { useRef, useEffect } from 'react';
import { initGSAP } from './gsapConfig';

export interface BlurTextProps extends React.HTMLAttributes<HTMLElement> {
  text: string;
  className?: string;
  delay?: number;
  duration?: number;
  stagger?: number;
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'span' | 'div';
  scrollTrigger?: boolean;
}

/**
 * React Bits BlurText powered by GSAP
 * Words fade into view smoothly while clearing blur(12px) to blur(0px).
 */
export function BlurText({
  text,
  className = '',
  delay = 0,
  duration = 0.8,
  stagger = 0.05,
  as: Tag = 'span',
  scrollTrigger = true,
  ...rest
}: BlurTextProps) {
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const { gsap, ScrollTrigger } = initGSAP();

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const words = containerRef.current.querySelectorAll('.blur-word');
    if (!words.length) return;

    gsap.set(words, {
      opacity: 0,
      filter: 'blur(10px)',
      y: 16,
    });

    const animVars: gsap.TweenVars = {
      opacity: 1,
      filter: 'blur(0px)',
      y: 0,
      duration,
      stagger,
      delay,
      ease: 'power2.out',
    };

    if (scrollTrigger) {
      animVars.scrollTrigger = {
        trigger: containerRef.current,
        start: 'top 85%',
        once: true,
      };
    }

    const tween = gsap.to(words, animVars);

    return () => {
      tween.kill();
    };
  }, [delay, duration, stagger, scrollTrigger, text]);

  const words = text.split(' ');

  return (
    <Tag
      ref={containerRef as any}
      className={`inline-block ${className}`}
      aria-label={text}
      {...rest}
    >
      {words.map((word, index) => (
        <span
          key={index}
          aria-hidden="true"
          className="blur-word inline-block will-change-transform"
          style={{ marginRight: index < words.length - 1 ? '0.28em' : 0 }}
        >
          {word}
        </span>
      ))}
    </Tag>
  );
}

export default BlurText;
