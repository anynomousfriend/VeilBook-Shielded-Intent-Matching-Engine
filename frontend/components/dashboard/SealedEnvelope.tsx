"use client";

import React, { useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

interface SealedEnvelopeProps {
  stage: "proving" | "sealed" | "matching";
}

const HASH_CHARS = "0123456789ABCDEFabcdef";

export default function SealedEnvelope({ stage }: SealedEnvelopeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const borderRef = useRef<SVGRectElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  
  const [displayText, setDisplayText] = useState("ENCRYPTING_PAYLOAD...");

  useGSAP(() => {
    if (stage === "proving" || stage === "matching") {
      // Spinning geometric loader
      gsap.to(borderRef.current, {
        strokeDashoffset: -200,
        duration: 2,
        repeat: -1,
        ease: "linear"
      });
      
      // Glitch text effect
      const scrambleInterval = setInterval(() => {
        let result = "";
        for(let i=0; i<16; i++) {
          result += HASH_CHARS[Math.floor(Math.random() * HASH_CHARS.length)];
        }
        setDisplayText("0x" + result);
      }, 50);
      
      return () => clearInterval(scrambleInterval);
    } else if (stage === "sealed") {
      gsap.to(borderRef.current, { strokeDashoffset: 0, opacity: 0.3, duration: 1 });
      setDisplayText("PAYLOAD_SEALED");
    }
  }, [stage]);

  return (
    <div ref={containerRef} className={`relative flex items-center justify-center ${stage === 'sealed' ? 'h-20' : 'h-32'} w-full border border-white/5 bg-black overflow-hidden group`}>
      {/* Dynamic SVG Border */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
        <rect 
          ref={borderRef}
          x="1" y="1" width="100%" height="100%" 
          fill="none" 
          stroke="rgba(255,255,255,0.8)" 
          strokeWidth="2"
          strokeDasharray="50 150"
          style={{ width: 'calc(100% - 2px)', height: 'calc(100% - 2px)' }}
        />
      </svg>
      
      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center gap-2">
        {stage !== "sealed" && (
          <div className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin mb-2" />
        )}
        <div 
          ref={textRef}
          className="font-mono text-[10px] md:text-xs text-white/70 tracking-[0.3em] uppercase break-all px-4 text-center"
        >
          {displayText}
        </div>
      </div>

      {/* Aesthetic corner marks */}
      <div className="absolute top-2 left-2 w-1 h-1 bg-white/20" />
      <div className="absolute bottom-2 right-2 w-1 h-1 bg-white/20" />
    </div>
  );
}
