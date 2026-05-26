"use client";

import React, { useRef, useEffect, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// 13 coordinate pairs (26 numbers) for perfect GSAP interpolation without MorphSVGPlugin
const PATHS = [
  // 0: Shield (Shielded Smart Contracts)
  "M 100 20 C 160 20 170 50 170 80 C 170 130 130 160 100 190 C 70 160 30 130 30 80 C 30 50 40 20 100 20 Z",
  // 1: Network (Midnight Network)
  "M 100 20 C 115 65 135 85 180 100 C 135 115 115 135 100 180 C 85 135 65 115 20 100 C 65 85 85 65 100 20 Z",
  // 2: Math/Certainty (Mathematical Certainty)
  "M 100 20 C 140 60 140 60 180 100 C 140 140 140 140 100 180 C 60 140 60 140 20 100 C 60 60 60 60 100 20 Z"
];

const ROTATIONS = [0, 90, 45];
const SCALES = [1, 1.1, 0.9];

export default function TechSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const pathGlowRef = useRef<SVGPathElement>(null);
  const groupRef = useRef<SVGGElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const cards = [
    { title: "Shielded Smart Contracts", desc: "Logic executes off-chain. Only state roots and proofs are submitted to the network." },
    { title: "Midnight Network", desc: "Built on a data-protection blockchain designed specifically for zero-knowledge applications." },
    { title: "Mathematical Certainty", desc: "Trust the cryptography, not the counterparty. Proofs guarantee execution without revealing inputs." }
  ];

  const animateToState = (index: number) => {
    if (!pathRef.current || !pathGlowRef.current || !groupRef.current) return;

    // Morph the paths
    gsap.to([pathRef.current, pathGlowRef.current], {
      attr: { d: PATHS[index] },
      duration: 1.2,
      ease: "elastic.out(1, 0.7)",
    });

    // Rotate and scale the group for extra dynamic feel
    gsap.to(groupRef.current, {
      rotation: ROTATIONS[index],
      scale: SCALES[index],
      duration: 1.2,
      ease: "power3.out",
      transformOrigin: "50% 50%"
    });
  };

  useEffect(() => {
    const ctx = gsap.context(() => {
      const triggers = gsap.utils.toArray('.tech-step');
      
      triggers.forEach((trigger: any, i: number) => {
        ScrollTrigger.create({
          trigger: trigger,
          start: "top center",
          end: "bottom center",
          onEnter: () => {
            setActiveIndex(i);
            animateToState(i);
          },
          onEnterBack: () => {
            setActiveIndex(i);
            animateToState(i);
          },
        });
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <section className="relative w-full bg-[#050505] tech-section" ref={containerRef}>
      <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row relative">
        
        {/* Left Column: Sticky Morphing Emblem */}
        <div className="w-full md:w-1/2 h-[50vh] md:h-screen sticky top-0 flex items-center justify-center z-0">
          <div className="relative w-full max-w-md aspect-square">
            <svg viewBox="0 0 200 200" className="w-full h-full overflow-visible">
              <defs>
                <filter id="emblem-glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="8" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Background rotating rings */}
              <circle cx="100" cy="100" r="90" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="2 6" className="origin-center animate-[spin_20s_linear_infinite]" />
              <circle cx="100" cy="100" r="70" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />

              {/* Morphing Group */}
              <g ref={groupRef} className="origin-center">
                {/* Glow Layer */}
                <path 
                  ref={pathGlowRef}
                  d={PATHS[0]} 
                  fill="none" 
                  stroke="rgba(255,255,255,0.3)" 
                  strokeWidth="4" 
                  filter="url(#emblem-glow)"
                />
                {/* Solid Layer */}
                <path 
                  ref={pathRef}
                  d={PATHS[0]} 
                  fill="rgba(255,255,255,0.02)" 
                  stroke="#ffffff" 
                  strokeWidth="1.5" 
                />
                {/* Center Core */}
                <circle cx="100" cy="100" r="4" fill="#ffffff" filter="url(#emblem-glow)" />
              </g>
            </svg>
          </div>
        </div>

        {/* Right Column: Scrolling Content */}
        <div className="w-full md:w-1/2 pb-[20vh] md:py-[30vh] z-10">
          {cards.map((card, i) => (
            <div 
              key={i} 
              className={`tech-step min-h-[50vh] md:min-h-screen flex flex-col justify-center transition-all duration-700 ease-out ${activeIndex === i ? 'opacity-100 translate-x-0' : 'opacity-20 translate-x-4'}`}
            >
              <div className="pl-8 border-l-2 border-white/10 relative">
                {/* Active Indicator Line */}
                <div 
                  className={`absolute left-[-2px] top-0 bottom-0 w-[2px] bg-white transition-transform duration-700 origin-top ${activeIndex === i ? 'scale-y-100' : 'scale-y-0'}`} 
                />
                
                <span className="font-mono text-white/70 text-sm tracking-widest uppercase mb-6 block">
                  0{i + 1} {`// Phase`}
                </span>
                <h3 className="text-3xl md:text-5xl font-medium text-white mb-6 tracking-tight">
                  {card.title}
                </h3>
                <p className="text-lg md:text-xl text-white/70 leading-relaxed font-mono max-w-md">
                  {card.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
