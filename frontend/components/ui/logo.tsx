import React from 'react';

export function Logo({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M 15 18 L 50 83 L 50 53 L 35 18 Z" fill="currentColor" />
      <path d="M 85 18 L 50 83 L 50 53 L 65 18 Z" fill="currentColor" fillOpacity="0.4" />
      <path d="M 35 18 L 65 18 L 50 53 Z" fill="currentColor" fillOpacity="0.1" />
      <circle cx="50" cy="32" r="4" fill="currentColor" />
    </svg>
  );
}
