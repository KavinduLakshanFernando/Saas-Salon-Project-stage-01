'use client';

import React, { useEffect, useRef, useState } from 'react';

export type ScrollAnimation =
  | 'fade-up'
  | 'fade-down'
  | 'fade-left'
  | 'fade-right'
  | 'zoom-in'
  | 'zoom-out'
  | 'fade';

export interface ScrollRevealProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
  animation?: ScrollAnimation;
  delay?: number; // in milliseconds
  duration?: number; // in milliseconds
  distance?: number; // in pixels
  threshold?: number;
  rootMargin?: string;
  once?: boolean;
  as?: React.ElementType;
}

/**
 * ScrollReveal: GPU-accelerated scroll-triggered entrance animation component.
 * Respects prefers-reduced-motion and includes a safety fallback for maximum reliability.
 */
export function ScrollReveal({
  children,
  animation = 'fade-up',
  delay = 0,
  duration = 700,
  distance = 36,
  threshold = 0.05,
  rootMargin = '0px 0px -40px 0px',
  once = true,
  as: Component = 'div',
  className = '',
  style = {},
  ...rest
}: ScrollRevealProps) {
  const ref = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Accessibility check: user prefers reduced motion
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setIsVisible(true);
      return;
    }

    // Fallback if browser does not support IntersectionObserver
    if (typeof window !== 'undefined' && !('IntersectionObserver' in window)) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (once) {
            observer.unobserve(el);
          }
        } else if (!once) {
          setIsVisible(false);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, [threshold, rootMargin, once]);

  // Initial transform based on animation direction
  const getInitialTransform = () => {
    switch (animation) {
      case 'fade-up':
        return `translate3d(0, ${distance}px, 0)`;
      case 'fade-down':
        return `translate3d(0, -${distance}px, 0)`;
      case 'fade-left':
        return `translate3d(-${distance}px, 0, 0)`;
      case 'fade-right':
        return `translate3d(${distance}px, 0, 0)`;
      case 'zoom-in':
        return `translate3d(0, ${Math.round(distance / 2)}px, 0) scale(0.95)`;
      case 'zoom-out':
        return `scale(1.05)`;
      case 'fade':
      default:
        return 'none';
    }
  };

  const combinedStyle: React.CSSProperties = {
    ...style,
    opacity: isVisible ? 1 : 0,
    transform: isVisible ? 'translate3d(0, 0, 0) scale(1)' : getInitialTransform(),
    transitionProperty: 'opacity, transform',
    transitionDuration: `${duration}ms`,
    transitionDelay: `${delay}ms`,
    transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
    willChange: isVisible ? 'auto' : 'opacity, transform',
  };

  return (
    <Component
      ref={ref}
      className={`scroll-reveal ${isVisible ? 'is-visible' : ''} ${className}`}
      style={combinedStyle}
      {...rest}
    >
      {children}
    </Component>
  );
}

export interface ScrollRevealGroupProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
  animation?: ScrollAnimation;
  staggerDelay?: number; // in milliseconds between children
  baseDelay?: number;
  duration?: number;
  distance?: number;
  threshold?: number;
  as?: React.ElementType;
}

/**
 * ScrollRevealGroup: Wraps child elements and cascades entrance animations with incremental delays.
 */
export function ScrollRevealGroup({
  children,
  animation = 'fade-up',
  staggerDelay = 90,
  baseDelay = 0,
  duration = 600,
  distance = 24,
  threshold = 0.1,
  as: Component = 'div',
  className = '',
  ...rest
}: ScrollRevealGroupProps) {
  const childArray = React.Children.toArray(children);

  return (
    <Component className={className} {...rest}>
      {childArray.map((child, index) => (
        <ScrollReveal
          key={index}
          animation={animation}
          delay={baseDelay + index * staggerDelay}
          duration={duration}
          distance={distance}
          threshold={threshold}
        >
          {child}
        </ScrollReveal>
      ))}
    </Component>
  );
}

/**
 * ScrollProgressBar: Slim luxury gradient progress line at the top of the viewport.
 */
export function ScrollProgressBar() {
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
          if (totalHeight > 0) {
            const current = window.scrollY;
            const progress = Math.min(Math.max((current / totalHeight) * 100, 0), 100);
            setScrollProgress(progress);
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div
      aria-hidden="true"
      className="fixed top-0 left-0 right-0 z-[60] h-[2.5px] pointer-events-none bg-transparent"
    >
      <div
        className="h-full bg-gradient-to-r from-violet-600 via-fuchsia-500 to-indigo-600 transition-all duration-75 ease-out shadow-[0_0_10px_rgba(124,58,237,0.7)]"
        style={{ width: `${scrollProgress}%` }}
      />
    </div>
  );
}
