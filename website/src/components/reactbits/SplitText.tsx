'use client';

import React, { useRef, useEffect } from 'react';
import { initGSAP } from './gsapConfig';

export interface SplitTextProps extends React.HTMLAttributes<HTMLElement> {
  text: string;
  className?: string;
  by?: 'words' | 'chars';
  delay?: number;
  duration?: number;
  stagger?: number;
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'span';
  scrollTrigger?: boolean;
}

/**
 * React Bits SplitText powered by GSAP
 * Splits text into words or characters and cascades them in on scroll using GSAP ScrollTrigger.
 */
export function SplitText({
  text,
  className = '',
  by = 'words',
  delay = 0,
  duration = 0.7,
  stagger = 0.04,
  as: Tag = 'span',
  scrollTrigger = true,
  ...rest
}: SplitTextProps) {
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const { gsap, ScrollTrigger } = initGSAP();

    // Check reduced motion preference
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const items = containerRef.current.querySelectorAll('.split-item');
    if (!items.length) return;

    // Set initial state
    gsap.set(items, {
      opacity: 0,
      y: 24,
      rotateX: -15,
      transformOrigin: '50% 100%',
    });

    const animVars: gsap.TweenVars = {
      opacity: 1,
      y: 0,
      rotateX: 0,
      duration,
      stagger,
      delay,
      ease: 'power3.out',
    };

    if (scrollTrigger) {
      animVars.scrollTrigger = {
        trigger: containerRef.current,
        start: 'top 88%',
        once: true,
      };
    }

    const tween = gsap.to(items, animVars);

    return () => {
      tween.kill();
    };
  }, [by, delay, duration, stagger, scrollTrigger, text]);

  const tokens = by === 'words' ? text.split(' ') : text.split('');

  return (
    <Tag
      ref={containerRef as any}
      className={`inline-block ${className}`}
      aria-label={text}
      {...rest}
    >
      {tokens.map((token, index) => (
        <span
          key={index}
          aria-hidden="true"
          className="split-item inline-block will-change-transform"
          style={{ display: 'inline-block', whiteSpace: by === 'words' ? 'pre' : 'normal' }}
        >
          {token}
          {by === 'words' && index < tokens.length - 1 ? ' ' : ''}
        </span>
      ))}
    </Tag>
  );
}

export default SplitText;
