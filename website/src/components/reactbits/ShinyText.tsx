'use client';

import React from 'react';

export interface ShinyTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  text: string;
  className?: string;
  shimmerWidth?: number;
  speed?: number; // in seconds
}

/**
 * React Bits ShinyText
 * A continuous luxury shimmer reflection passing through text.
 */
export function ShinyText({
  text,
  className = '',
  shimmerWidth = 100,
  speed = 3.5,
  style = {},
  ...rest
}: ShinyTextProps) {
  return (
    <span
      className={`inline-block relative overflow-hidden bg-clip-text text-transparent bg-[linear-gradient(110deg,#a78bfa,45%,#ffffff,55%,#a78bfa)] bg-[length:250%_100%] animate-[shine_linear_infinite] ${className}`}
      style={{
        animationDuration: `${speed}s`,
        ...style,
      }}
      {...rest}
    >
      {text}
    </span>
  );
}

export default ShinyText;
