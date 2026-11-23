'use client';

import { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

export function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const current = window.scrollY;
          setIsVisible(current > 260);

          const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
          if (totalHeight > 0) {
            setScrollProgress(Math.min(Math.max(current / totalHeight, 0), 1));
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

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  const circumference = 2 * Math.PI * 18;
  const strokeDashoffset = circumference - scrollProgress * circumference;

  return (
    <button
      onClick={scrollToTop}
      aria-label="Scroll to top"
      className={`group fixed bottom-18 right-4 sm:bottom-24 sm:right-6 z-50 flex h-11 w-11 sm:h-13 sm:w-13 items-center justify-center rounded-full bg-violet-600/90 hover:bg-violet-600 text-white backdrop-blur-md shadow-xl hover:shadow-2xl hover:shadow-violet-600/30 transition-all duration-300 transform hover:scale-105 active:scale-95 cursor-pointer ${
        isVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-90 pointer-events-none'
      }`}
    >
      {/* Circular SVG Scroll Progress Ring */}
      <svg
        className="absolute inset-0 size-full -rotate-90 pointer-events-none p-0.5"
        viewBox="0 0 40 40"
      >
        <circle
          cx="20"
          cy="20"
          r="18"
          stroke="rgba(255, 255, 255, 0.2)"
          strokeWidth="2.5"
          fill="none"
        />
        <circle
          cx="20"
          cy="20"
          r="18"
          stroke="#ffffff"
          strokeWidth="2.5"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-100"
        />
      </svg>

      <ArrowUp className="h-4 w-4 sm:h-5 sm:w-5 relative z-10 transition-transform duration-200 group-hover:-translate-y-0.5" />

      {/* Hover Tooltip */}
      <span className="absolute right-15 sm:right-16 top-1/2 -translate-y-1/2 rounded-lg bg-slate-900/95 dark:bg-[#1f1633] border border-slate-700/60 dark:border-[#362453] px-3 py-1.5 text-xs font-semibold text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 pointer-events-none whitespace-nowrap shadow-lg">
        Scroll to top
      </span>
    </button>
  );
}

