import React, { useId } from "react";

export default function BrandMark({ size = 28, className = "" }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      className={`brand-mark-svg ${className}`}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${id}-a`} x1="4" y1="6" x2="20" y2="26">
          <stop stopColor="#7CFFD4" />
          <stop offset="1" stopColor="#5B8CFF" />
        </linearGradient>
        <linearGradient id={`${id}-b`} x1="14" y1="4" x2="30" y2="24">
          <stop stopColor="#C084FC" />
          <stop offset="1" stopColor="#FB7185" />
        </linearGradient>
      </defs>
      <circle cx="12.5" cy="16" r="8.2" fill={`url(#${id}-a)`} opacity="0.92" />
      <circle cx="19.5" cy="16" r="8.2" fill={`url(#${id}-b)`} opacity="0.78" />
      <path
        d="M8 16c1.2-3 2.4-3 3.6 0s2.4 3 3.6 0 2.4-3 3.6 0 2.4 3 3.6 0"
        stroke="#fff"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.9"
      />
    </svg>
  );
}
