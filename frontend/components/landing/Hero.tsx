import React from 'react';
import Link from 'next/link';
import ThreeLogo from './ThreeLogo';

export default function Hero() {
  return (
    <section className="relative w-full h-screen flex items-center justify-center bg-[#050505] overflow-hidden hero-section">
      {/* Stage Light for 3D object */}
      <div className="absolute top-1/2 right-0 md:right-[10%] w-[400px] md:w-[600px] h-[400px] md:h-[600px] -translate-y-1/2 bg-white/[0.015] rounded-full blur-[100px] pointer-events-none z-0" />

      {/* Background Grid */}
      <div className="absolute inset-0 z-0 pointer-events-none" style={{
        backgroundImage: `
          linear-gradient(to right, rgba(255, 255, 255, 0.04) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(255, 255, 255, 0.04) 1px, transparent 1px)
        `,
        backgroundSize: '50px 50px',
        backgroundPosition: 'center center',
        maskImage: 'radial-gradient(circle at center, black 10%, transparent 70%)',
        WebkitMaskImage: 'radial-gradient(circle at center, black 10%, transparent 70%)'
      }} />

      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center h-full">
        {/* Left: Text */}
        <div className="w-full md:w-1/2 flex flex-col items-start text-left pt-20 md:pt-0">
          <h1 className="text-5xl md:text-7xl font-medium tracking-tight text-white mb-6 hero-title opacity-0 translate-y-3">
            Trade Without a Trace.
          </h1>
          <p className="text-lg md:text-xl text-white/60 max-w-xl mb-10 font-mono hero-subtitle opacity-0 translate-y-3">
            Zero-knowledge block trading on the Midnight Network. The network sees a hash, not a price.
          </p>
          <Link href="/demo" className="px-8 py-4 bg-white text-black font-medium text-sm tracking-widest uppercase hover:bg-white/90 transition-colors hero-cta opacity-0 inline-block">
            Launch Demo
          </Link>
        </div>

        {/* Right: 3D Logo */}
        <div className="w-full md:w-1/2 h-[50vh] md:h-full relative hero-logo opacity-0">
          <ThreeLogo />
        </div>
      </div>
    </section>
  );
}
