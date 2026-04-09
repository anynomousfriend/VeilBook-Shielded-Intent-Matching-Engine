"use client";

import React, { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

interface MatchOverlayProps {
  labelA?: string;
  labelB?: string;
}

export default function MatchOverlay({ labelA = "YOU", labelB = "PEER" }: MatchOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const leftLineRef = useRef<SVGLineElement>(null);
  const rightLineRef = useRef<SVGLineElement>(null);
  const centerNodeRef = useRef<SVGRectElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const tl = gsap.timeline({ repeat: -1 });

    // Initial state
    gsap.set([leftLineRef.current, rightLineRef.current], { strokeDasharray: "100", strokeDashoffset: 100 });
    gsap.set(centerNodeRef.current, { scale: 0, rotation: 45, opacity: 0 });
    gsap.set(textRef.current, { opacity: 0.5 });

    tl.to(leftLineRef.current, { strokeDashoffset: 0, duration: 0.6, ease: "power2.inOut" }, 0)
      .to(rightLineRef.current, { strokeDashoffset: 0, duration: 0.6, ease: "power2.inOut" }, 0)
      .to(centerNodeRef.current, { scale: 1, opacity: 1, duration: 0.4, ease: "back.out(2)" }, 0.4)
      .to(centerNodeRef.current, { scale: 1.2, opacity: 0, duration: 0.3, ease: "power2.in" }, 1.5)
      .to([leftLineRef.current, rightLineRef.current], { opacity: 0, duration: 0.3 }, 1.5);

    gsap.to(textRef.current, { opacity: 1, duration: 1, yoyo: true, repeat: -1, ease: "sine.inOut" });
  }, { scope: containerRef });

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none"
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />

      <div className="relative z-10 text-center space-y-12">
        <div className="flex items-center justify-center relative w-[400px] h-32 mx-auto">
          <div className="absolute left-0 w-20 h-14 border border-white/20 bg-white/5 backdrop-blur-sm flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.05)]">
            <span className="font-mono text-[10px] text-white/50 tracking-widest">{labelA}</span>
          </div>

          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 128" fill="none">
            <line ref={leftLineRef} x1="80" y1="64" x2="195" y2="64" stroke="white" strokeWidth="1.5" opacity="0.8" />
            <line ref={rightLineRef} x1="320" y1="64" x2="205" y2="64" stroke="white" strokeWidth="1.5" opacity="0.8" />
            <rect ref={centerNodeRef} x="195" y="59" width="10" height="10" fill="white" transform="rotate(45 200 64)" className="shadow-[0_0_20px_white]" />
          </svg>

          <div className="absolute right-0 w-20 h-14 border border-white/20 bg-white/5 backdrop-blur-sm flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.05)]">
            <span className="font-mono text-[10px] text-white/50 tracking-widest">{labelB}</span>
          </div>
        </div>

        <div className="space-y-3" ref={textRef}>
          <p className="font-mono text-sm text-white/80 tracking-[0.2em] uppercase">
            [ Verifying_Cryptographic_Match ]
          </p>
          <p className="text-[10px] font-mono text-white/40 max-w-md mx-auto leading-relaxed tracking-widest uppercase">
            Zero-knowledge proofs evaluating. <br/> No plaintext values exposed to network.
          </p>
        </div>
      </div>
    </div>
  );
}
