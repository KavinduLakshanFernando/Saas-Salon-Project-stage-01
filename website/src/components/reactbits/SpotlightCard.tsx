'use client';

import React, { useRef, useState, useCallback } from 'react';

export interface SpotlightCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  spotlightColor?: string;
  size?: number;
}

/**
 * React Bits SpotlightCard
 * Creates a mouse-following iridescent radial spotlight across glass cards.
 */
export function SpotlightCard({
  children,
  className = '',
  spotlightColor = 'rgba(139, 92, 246, 0.18)',
  size = 360,
  style = {},
  ...rest
}: SpotlightCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: -size, y: -size });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!cardRef.current) return;
      const rect = cardRef.current.getBoundingClientRect();
      setPosition({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
      setOpacity(1);
    },
    []
  );

  const handleMouseEnter = useCallback(() => {
    setOpacity(1);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setOpacity(0);
  }, []);

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative transition-all duration-300 ${className}`}
      style={{
        ...style,
      }}
      {...rest}
    >
      {/* Spotlight overlay strictly clipped to card corners without clipping external badges */}
      <div
        className="pointer-events-none absolute inset-0 rounded-[inherit] overflow-hidden z-10"
        aria-hidden="true"
      >
        <div
          className="absolute inset-0 transition-opacity duration-300 ease-out"
          style={{
            opacity,
            background: `radial-gradient(${size}px circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 75%)`,
          }}
        />
      </div>
      {children}
    </div>
  );
}

export default SpotlightCard;
