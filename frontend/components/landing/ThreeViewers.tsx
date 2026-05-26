"use client";

import React, { useRef, useEffect, useCallback } from 'react';
import gsap from 'gsap';

const STATIC_HASHES = [
  "0x8f7a9b2c4d1e3f5a", "0x9c3d4e5f6a7b8c9d", "0x1a2b3c4d5e6f7a8b",
  "0x5e6f7a8b9c0d1e2f", "0x3c4d5e6f7a8b9c0d", "0x7a8b9c0d1e2f3c4d",
  "0x2f3c4d5e6f7a8b9c", "0x0d1e2f3c4d5e6f7a", "0x4d5e6f7a8b9c0d1e",
  "0x6a7b8c9d0e1f2a3b", "0x1e2f3c4d5e6f7a8b", "0x8b9c0d1e2f3c4d5e",
  "0x5f6a7b8c9d0e1f2a", "0x2a3b4c5d6e7f8a9b", "0x9d0e1f2a3b4c5d6e",
  "0x4c5d6e7f8a9b0c1d", "0x7f8a9b0c1d2e3f4a", "0x3b4c5d6e7f8a9b0c",
  "0x0c1d2e3f4a5b6c7d", "0x6e7f8a9b0c1d2e3f"
];

export default function ThreeViewers() {
  const containerRef = useRef<HTMLDivElement>(null);
  const proxy = useRef({ x: 50, y: 50 });
  const animationRef = useRef<gsap.core.Tween | null>(null);
  const isHovering = useRef(false);

  const updateCSS = () => {
    if (containerRef.current) {
      containerRef.current.style.setProperty('--lens-x', `${proxy.current.x}%`);
      containerRef.current.style.setProperty('--lens-y', `${proxy.current.y}%`);
    }
  };

  const startFloatingRef = useRef<() => void>(() => {});

  const startFloating = useCallback(() => {
    if (isHovering.current) return;
    animationRef.current = gsap.to(proxy.current, {
      x: () => gsap.utils.random(20, 80),
      y: () => gsap.utils.random(20, 80),
      duration: gsap.utils.random(3, 5),
      ease: "sine.inOut",
      onComplete: () => startFloatingRef.current(),
      onUpdate: updateCSS
    });
  }, []);

  useEffect(() => {
    startFloatingRef.current = startFloating;
  }, [startFloating]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      startFloating();
    }, containerRef);
    return () => ctx.revert();
  }, [startFloating]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    isHovering.current = true;
    if (animationRef.current) animationRef.current.kill();
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    gsap.to(proxy.current, {
      x,
      y,
      duration: 0.5,
      ease: "power2.out",
      onUpdate: updateCSS
    });
  };

  const handleMouseLeave = () => {
    isHovering.current = false;
    startFloating();
  };

  return (
    <section 
      className="relative w-full min-h-screen flex flex-col items-center justify-center bg-black py-32 viewers-section" 
      ref={containerRef}
      style={{ '--lens-x': '50%', '--lens-y': '50%' } as React.CSSProperties}
    >
      <div className="max-w-6xl w-full px-6">
        <div className="text-center mb-16 viewers-title opacity-0 translate-y-3">
          <span className="font-mono text-white/40 tracking-widest uppercase mb-4 block text-sm font-semibold">Information Asymmetry</span>
          <h2 className="text-4xl md:text-5xl text-white font-medium">
            The Cryptographic Lens
          </h2>
        </div>
        
        <div 
          className="relative w-full h-[500px] bg-[#0a0a0a] border border-white/10 rounded-3xl overflow-hidden cursor-crosshair viewers-container opacity-0 translate-y-5"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {/* Base Layer: Public Ledger (Encrypted) */}
          <div className="absolute inset-0 p-8 flex flex-col justify-center overflow-hidden">
             <div className="absolute top-8 left-8 text-white/30 font-mono text-sm uppercase tracking-widest flex items-center gap-3">
               <div className="w-2 h-2 rounded-full bg-white/20" />
               Public Network View
             </div>
             <div className="font-mono text-white/10 text-sm md:text-base leading-loose break-all opacity-60 select-none mt-12">
               {Array(8).fill(STATIC_HASHES.join(" ")).map((line, i) => (
                 <div key={i} className="whitespace-nowrap overflow-hidden">{line}</div>
               ))}
             </div>
          </div>

          {/* Top Layer: Private View (Clear) */}
          <div 
            className="absolute inset-0 bg-zinc-900 flex flex-col justify-center items-center pointer-events-none"
            style={{ 
              clipPath: 'circle(150px at var(--lens-x) var(--lens-y))', 
              WebkitClipPath: 'circle(150px at var(--lens-x) var(--lens-y))' 
            }}
          >
             {/* Subtle grid background for the private view */}
             <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

             <div className="absolute top-8 left-8 text-white font-mono text-sm uppercase tracking-widest flex items-center gap-3">
               <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
               Maker / Taker View
             </div>
             
             {/* Clear Trade Data */}
             <div className="border border-white/20 bg-black p-8 rounded-xl w-full max-w-md shadow-2xl relative z-10">
                <div className="space-y-6 font-mono text-lg text-white">
                  <div className="flex justify-between border-b border-white/10 pb-4">
                    <span className="text-white/50">Asset</span>
                    <span>Ethereum (ETH)</span>
                  </div>
                  <div className="flex justify-between border-b border-white/10 pb-4">
                    <span className="text-white/50">Amount</span>
                    <span>5,000.00</span>
                  </div>
                  <div className="flex justify-between border-b border-white/10 pb-4">
                    <span className="text-white/50">Price</span>
                    <span>$3,400.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">Action</span>
                    <span className="text-white">BUY</span>
                  </div>
                </div>
             </div>
          </div>

          {/* Lens Ring Overlay */}
          <div 
            className="absolute w-[300px] h-[300px] rounded-full border border-white/30 pointer-events-none -translate-x-1/2 -translate-y-1/2 shadow-[inset_0_0_40px_rgba(255,255,255,0.1)] viewers-lens opacity-0 scale-50"
            style={{ left: 'var(--lens-x)', top: 'var(--lens-y)' }}
          >
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-mono text-white/80 tracking-widest bg-black/80 border border-white/20 px-3 py-1 rounded-full backdrop-blur-md">
              DECRYPTED
            </div>
            {/* Crosshairs */}
            <div className="absolute top-1/2 left-0 w-4 h-[1px] bg-white/50 -translate-y-1/2" />
            <div className="absolute top-1/2 right-0 w-4 h-[1px] bg-white/50 -translate-y-1/2" />
            <div className="absolute left-1/2 top-0 w-[1px] h-4 bg-white/50 -translate-x-1/2" />
            <div className="absolute left-1/2 bottom-0 w-[1px] h-4 bg-white/50 -translate-x-1/2" />
          </div>
        </div>
      </div>
    </section>
  );
}
