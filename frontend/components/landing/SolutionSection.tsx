import React, { useState, useEffect, useRef } from 'react';

// Math helpers
const lerp = (start: number, end: number, t: number) => start + (end - start) * t;
const easeInOutCubic = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOutExpo = (t: number) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t);

const FeatureIcon = ({ name }: { name: string }) => {
  switch (name) {
    case 'shield':
      return (
        <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" opacity="0.8" />
          <path d="M12 8v4" stroke="currentColor" strokeWidth="2">
            <animate attributeName="opacity" values="0.2;1;0.2" dur="2s" repeatCount="indefinite" />
          </path>
          {/* Pulsing inner logic core */}
          <circle cx="12" cy="15" r="2" fill="currentColor">
            <animate attributeName="opacity" values="0.2;1;0.2" dur="2s" repeatCount="indefinite" />
          </circle>
        </svg>
      );
    case 'network':
      return (
        <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <g className="origin-center animate-[spin_10s_linear_infinite]">
            <circle cx="12" cy="12" r="8" strokeDasharray="4 4" opacity="0.4" />
          </g>
          <circle cx="12" cy="12" r="3" fill="currentColor">
            <animate attributeName="opacity" values="0.5;1;0.5" dur="3s" repeatCount="indefinite" />
          </circle>
          {/* Surrounding network nodes */}
          <circle cx="12" cy="4" r="1.5" fill="currentColor" />
          <circle cx="20" cy="12" r="1.5" fill="currentColor" />
          <circle cx="12" cy="20" r="1.5" fill="currentColor" />
          <circle cx="4" cy="12" r="1.5" fill="currentColor" />
          <path d="M12 6v3M18 12h-3M12 18v-3M6 12h3" opacity="0.6">
             <animate attributeName="opacity" values="0.2;0.8;0.2" dur="2s" repeatCount="indefinite" />
          </path>
        </svg>
      );
    case 'math':
      return (
        <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          {/* Mathematical brackets representing cryptographic proof */}
          <path d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h2M16 4h2a2 2 0 012 2v12a2 2 0 01-2 2h-2" opacity="0.6"/>
          {/* Abstract geometric hash */}
          <polygon points="12 8 15.5 14 8.5 14" opacity="0.5">
             <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="8s" repeatCount="indefinite" />
          </polygon>
          <circle cx="12" cy="12" r="2" fill="currentColor">
             <animate attributeName="opacity" values="0.3;1;0.3" dur="2s" repeatCount="indefinite" />
          </circle>
        </svg>
      );
    default:
      return null;
  }
};

const ZKVisualizer = ({ time }: { time: number }) => {
  const duration = 6000;
  const t = (time % duration) / duration; 

  const cx = 400, cy = 300;

  let p1X = 100, p1Y = 300;
  let p2X = 700, p2Y = 300;
  let encryptDash = "0";

  if (t < 0.3) {
    let pt = easeOutExpo(t / 0.3);
    p1X = lerp(100, cx - 40, pt);
    p2X = lerp(700, cx + 40, pt);
    if (pt > 0.5) encryptDash = "6 6";
  } else if (t >= 0.3 && t < 0.6) {
    encryptDash = "6 6";
    let pt = easeInOutCubic((t - 0.3) / 0.3);
    let angle = pt * Math.PI;
    p1X = cx - Math.cos(angle) * 40;
    p1Y = cy - Math.sin(angle) * 40;
    p2X = cx + Math.cos(angle) * 40;
    p2Y = cy + Math.sin(angle) * 40;
  } else {
    encryptDash = "0";
    let pt = easeInOutCubic((t - 0.6) / 0.4);
    p1X = lerp(cx + 40, 700, pt);
    p2X = lerp(cx - 40, 100, pt);
  }

  const engineGlow = t > 0.4 && t < 0.6 ? Math.sin(((t-0.4)/0.2)*Math.PI) : 0;

  let ripR = 0, ripOp = 0;
  if (t > 0.6 && t < 0.8) {
    let rt = (t - 0.6) / 0.2;
    ripR = lerp(50, 400, easeOutExpo(rt));
    ripOp = lerp(1, 0, rt);
  }

  return (
    <div className="absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none overflow-hidden">
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] blur-[100px] transition-all duration-700 ease-in-out opacity-15 scale-100"
        style={{ background: 'radial-gradient(circle, #ffffff 0%, transparent 70%)' }}
      />
      
      <svg 
        viewBox="0 0 800 600" 
        className="w-full h-full relative z-10 drop-shadow-2xl transition-all duration-700 ease-[cubic-bezier(0.4,0,0.2,1)] scale-100 opacity-100 blur-0"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="glow-strong" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="12" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        
        <g>
          {/* Enclave */}
          <circle cx={cx} cy={cy} r="120" fill="#18181b" stroke="#3f3f46" strokeWidth="2" strokeDasharray="12 12"/>
          <circle cx={cx} cy={cy} r="100" fill="#09090b" stroke="#52525b" strokeWidth="1" />
          <text x={cx} y={cy - 140} fill="#71717a" fontSize="12" textAnchor="middle" fontFamily="monospace" letterSpacing="2">MIDNIGHT_ENCLAVE</text>

          {/* Ripple / Proof Submission */}
          {ripOp > 0 && <circle cx={cx} cy={cy} r={ripR} stroke="#e4e4e7" strokeWidth="4" fill="none" opacity={ripOp} filter="url(#glow)"/>}
          {ripOp > 0 && <text x={cx} y={cy + 40} fill="#e4e4e7" opacity={ripOp} fontSize="12" textAnchor="middle" fontFamily="monospace" letterSpacing="2" filter="url(#glow-strong)">PROOF_GENERATED</text>}

          {/* Engine Core */}
          <circle cx={cx} cy={cy} r="16" fill="#71717a" opacity="0.5" />
          {engineGlow > 0 && <circle cx={cx} cy={cy} r={16 + engineGlow*16} fill="#e4e4e7" opacity={engineGlow} filter="url(#glow-strong)" />}

          {/* Payload 1 (Shielded State) */}
          <circle cx={p1X} cy={p1Y} r="20" fill="#e4e4e7" filter="url(#glow)" />
          <circle cx={p1X} cy={p1Y} r="26" fill="none" stroke="#a1a1aa" strokeWidth="2" strokeDasharray={encryptDash} />

          {/* Payload 2 (Shielded State) */}
          <circle cx={p2X} cy={p2Y} r="20" fill="#e4e4e7" filter="url(#glow)" />
          <circle cx={p2X} cy={p2Y} r="26" fill="none" stroke="#a1a1aa" strokeWidth="2" strokeDasharray={encryptDash} />
        </g>
      </svg>
    </div>
  );
};

export default function SolutionSection() {
  const [time, setTime] = useState(0);
  const timeRef = useRef(0);

  useEffect(() => {
    let lastTime = performance.now();
    let animId: number;

    const loop = (now: number) => {
      const dt = now - lastTime;
      lastTime = now;
      timeRef.current += dt;
      setTime(timeRef.current);
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  const zkTab = {
    features: [
      { icon: 'shield', title: 'Shielded Smart Contracts', desc: 'Logic executes off-chain. Only state roots and proofs are submitted to the network.' },
      { icon: 'network', title: 'Midnight Network', desc: 'Built on a data-protection blockchain designed specifically for zero-knowledge applications.' },
      { icon: 'math', title: 'Mathematical Certainty', desc: 'Trust the cryptography, not the counterparty. Proofs guarantee execution without revealing inputs.' }
    ]
  };

  return (
    <section className="relative w-full min-h-screen bg-[#050505] flex flex-col items-center justify-center py-20 px-4 overflow-hidden border-t border-white/5 z-30 solution-section">
      
      {/* Subtle radial background for the section */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/[0.02] via-[#050505] to-black pointer-events-none" />

      <div className="relative z-10 max-w-6xl w-full flex flex-col items-center">
        
        {/* Section Header */}
        <div className="text-center mb-16 solution-title opacity-0 translate-y-3">
          <span className="font-mono text-white/40 tracking-widest uppercase mb-4 block text-sm font-semibold">The Solution</span>
          <h2 className="text-5xl md:text-6xl font-medium text-white mb-6">Zero-Knowledge Execution</h2>
          <p className="text-xl text-white/60 max-w-2xl mx-auto leading-relaxed font-mono">
            Cryptographic privacy for block trades. Orders are sealed, matched without revealing intent, and settled on-chain seamlessly.
          </p>
        </div>

        {/* Standalone ZK Visualizer */}
        <div className="w-full max-w-4xl h-[400px] md:h-[500px] relative mb-20 rounded-3xl border border-white/10 bg-[#0a0a0a] shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden backdrop-blur-xl solution-visualizer opacity-0 scale-95">
          <ZKVisualizer time={time} />
          
          {/* Overlay tech decorative elements */}
          <div className="absolute top-4 left-6 text-xs font-mono text-white/40 tracking-widest">SECURE.ENCLAVE_ACTIVE</div>
          <div className="absolute bottom-4 right-6 flex gap-1">
             <div className="w-2 h-2 rounded-full bg-white/60 animate-pulse"></div>
             <div className="w-2 h-2 rounded-full bg-white/20"></div>
          </div>
        </div>

        {/* Feature Pipeline */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl relative">
          
          {/* Connecting background line (Desktop only) */}
          <div className="hidden md:block absolute top-12 left-[15%] right-[15%] h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent z-0 solution-line-mask" style={{ width: '0%' }} />

          {zkTab.features.map((feat, idx) => (
            <div key={idx} className="group relative z-10 flex flex-col items-center text-center p-8 bg-[#0a0a0a] border border-white/5 rounded-3xl backdrop-blur-sm transition-all duration-500 hover:-translate-y-2 hover:bg-white/5 hover:border-white/20 hover:shadow-2xl solution-step opacity-0 scale-90">
              
              <div className="w-16 h-16 rounded-2xl bg-black border border-white/10 flex items-center justify-center text-white/40 group-hover:text-white group-hover:border-white/30 transition-colors duration-500 mb-6 shadow-xl relative overflow-hidden">
                {/* Subtle animated background glow on hover */}
                <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors duration-500 blur-xl"></div>
                <div className="relative z-10">
                  <FeatureIcon name={feat.icon} />
                </div>
              </div>
              
              <h3 className="text-xl font-bold text-white/80 group-hover:text-white transition-colors duration-500 mb-3 tracking-tight">{feat.title}</h3>
              <p className="text-white/50 group-hover:text-white/70 transition-colors duration-500 leading-relaxed text-sm md:text-base">{feat.desc}</p>
              
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
