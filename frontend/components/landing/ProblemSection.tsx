import React, { useState, useEffect, useRef, useMemo } from 'react';

/**
 * Standard colors and durations
 */
const SCENE_DURATIONS = [4000, 3000, 5000];

const COLORS = {
  grid: { top: '#27272a', left: '#18181b', right: '#09090b' },
  grid_dim: { top: '#18181b', left: '#09090b', right: '#000000' },
  whale: { top: '#f4f4f5', left: '#d4d4d8', right: '#a1a1aa' },
  predator: { top: '#52525b', left: '#3f3f46', right: '#27272a' },
  warning: { top: '#a1a1aa', left: '#71717a', right: '#52525b' },
  warning_light: { top: '#e4e4e7', left: '#d4d4d8', right: '#a1a1aa' },
  otc_base: { top: '#3f3f46', left: '#27272a', right: '#18181b' },
  otc: { top: '#d4d4d8', left: '#a1a1aa', right: '#71717a' },
};

// Math helpers
const lerp = (start: number, end: number, t: number) => start + (end - start) * t;
const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);
const easeInOutCubic = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOutExpo = (t: number) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t);

/**
 * Isometric Block Component
 */
const IsoBlock = ({ x, y, z, size, height, type, opacity = 1, glow = false }: any) => {
  const colors = (COLORS as any)[type] || COLORS.grid;
  const px = (x - y) * size;
  const py = (x + y) * (size / 2) - z * size;

  const t_0 = `${px},${py}`;
  const t_1 = `${px + size},${py + size / 2}`;
  const t_2 = `${px},${py + size}`;
  const t_3 = `${px - size},${py + size / 2}`;

  const l_0 = `${px - size},${py + size / 2}`;
  const l_1 = `${px},${py + size}`;
  const l_2 = `${px},${py + size + height * size}`;
  const l_3 = `${px - size},${py + size / 2 + height * size}`;

  const r_0 = `${px},${py + size}`;
  const r_1 = `${px + size},${py + size / 2}`;
  const r_2 = `${px + size},${py + size / 2 + height * size}`;
  const r_3 = `${px},${py + size + height * size}`;

  return (
    <g opacity={opacity} filter={glow ? "url(#glow)" : undefined} className="transition-opacity duration-300">
      <polygon points={`${t_0} ${t_1} ${t_2} ${t_3}`} fill={colors.top} />
      <polygon points={`${l_0} ${l_1} ${l_2} ${l_3}`} fill={colors.left} />
      <polygon points={`${r_0} ${r_1} ${r_2} ${r_3}`} fill={colors.right} />
    </g>
  );
};

/**
 * Visualizer Engine (Stateless, driven by App time)
 */
const Visualizer = ({ displayTab, time, isExiting }: any) => {
  const size = 32;

  const blocks = useMemo(() => {
    let newBlocks: any[] = [];
    const duration = displayTab === -1 ? 6000 : SCENE_DURATIONS[displayTab];
    const t = (time % duration) / duration; // Normalize 0 to 1

    if (displayTab === -1) {
      // Idle / Overview State (Gentle undulating dark matrix)
      for (let i = -4; i <= 4; i++) {
        for (let j = -4; j <= 4; j++) {
          let dist = Math.sqrt(i * i + j * j);
          let zOffset = Math.sin(t * Math.PI * 2 - dist * 0.5) * 0.15;
          newBlocks.push({ id: `idle_${i}_${j}`, x: i, y: j, z: zOffset, size: 1, height: 0.1, type: 'grid_dim' });
        }
      }
      // Subtle central pulsing core
      newBlocks.push({ id: 'idle_center', x: 0, y: 0, z: Math.sin(t * Math.PI * 2) * 0.15 + 0.1, size: 1.2, height: 0.15, type: 'otc_base', glow: true });

    } else if (displayTab === 0) {
      for (let i = -5; i <= 5; i++) {
        for (let j = -1; j <= 1; j++) {
          newBlocks.push({ id: `g_${i}_${j}`, x: i, y: j, z: 0, size: 1, height: 0.15, type: 'grid' });
        }
      }
      let wx = lerp(-7, 7, t);
      // Increased z to 0.6 so the bottom of the block (0.6 - 0.5 height) is 0.1, strictly above the floor (0.0)
      newBlocks.push({ id: 'whale', x: wx, y: 0, z: 0.6, size: 0.8, height: 0.5, type: 'whale', glow: true });

      if (t > 0.05 && t < 0.9) {
        let catchUpT = clamp((t - 0.05) / 0.4, 0, 1);
        let relX = lerp(-4.0, 1.2, easeInOutCubic(catchUpT));
        let px1 = wx + relX;
        
        let mergeT = clamp((catchUpT - 0.7) / 0.3, 0, 1);
        let py1 = lerp(1, 0, easeInOutCubic(mergeT));
        
        newBlocks.push({ id: 'p1', x: px1, y: py1, z: 0.5, size: 0.4, height: 0.3, type: 'predator', glow: true });
      }
      if (t > 0.15 && t < 0.95) {
        let catchUpT = clamp((t - 0.15) / 0.4, 0, 1);
        let relX = lerp(-5.0, 2.2, easeInOutCubic(catchUpT));
        let px2 = wx + relX;
        
        let mergeT = clamp((catchUpT - 0.7) / 0.3, 0, 1);
        let py2 = lerp(-1, 0, easeInOutCubic(mergeT));
        
        newBlocks.push({ id: 'p2', x: px2, y: py2, z: 0.5, size: 0.4, height: 0.3, type: 'predator', glow: true });
      }
    } else if (displayTab === 1) {
      for (let i = -3; i <= 3; i++) {
        for (let j = -3; j <= 3; j++) {
          let dist = Math.abs(i) + Math.abs(j);
          let zOffset = 0;
          if (t > 0.3) {
            let dropT = clamp((t - 0.3) * 2.5 - dist * 0.15, 0, 1);
            zOffset = Math.sin(dropT * Math.PI) * -0.4;
          }
          newBlocks.push({ id: `g_${i}_${j}`, x: i, y: j, z: zOffset, size: 1, height: 0.15, type: 'grid' });
        }
      }
      let burst = t > 0.2 && t < 0.8;
      let burstT = burst ? (t - 0.2) / 0.6 : 0;
      let ch = 0.6, cScale = 0.8;
      if (burst) {
        ch += Math.sin(burstT * Math.PI) * 0.3;
        cScale += Math.sin(burstT * Math.PI) * 0.1;
      }
      newBlocks.push({ id: 'c', x: 0, y: 0, z: 0.15, size: cScale, height: ch, type: 'warning', glow: true });

      if (t > 0.25 && t < 0.9) {
        let pt = (t - 0.25) / 0.65;
        let pDist = lerp(0, 3.5, easeOutExpo(pt));
        let pOpac = pt < 0.8 ? 1 : lerp(1, 0, (pt - 0.8) / 0.2);
        [[1,0], [-1,0], [0,1], [0,-1]].forEach((off, idx) => {
          newBlocks.push({
            id: `part_${idx}`, x: off[0] * pDist, y: off[1] * pDist, z: 0.4 - pt * 0.4,
            size: 0.2, height: 0.2, type: 'warning_light', opacity: pOpac, glow: true
          });
        });
      }
    } else if (displayTab === 2) {
      newBlocks.push({ id: 'p_user', x: -3, y: 0, z: 0, size: 1.2, height: 0.2, type: 'grid' });
      newBlocks.push({ id: 'b1', x: -1.5, y: 0, z: -0.1, size: 0.8, height: 0.05, type: 'grid_dim' });
      newBlocks.push({ id: 'p_mkt', x: 3, y: 0, z: 0, size: 1.2, height: 0.2, type: 'grid' });
      newBlocks.push({ id: 'b2', x: 1.5, y: 0, z: -0.1, size: 0.8, height: 0.05, type: 'grid_dim' });

      let lidZ = 0.2, otcType = 'otc', otcGlow = false;
      if (t > 0.2 && t < 0.7) {
        let openT = Math.sin((t - 0.2) / 0.5 * Math.PI);
        lidZ = 0.2 + openT * 0.8;
        if (openT > 0.3) { otcType = 'predator'; otcGlow = true; }
      }
      
      newBlocks.push({ id: 'otc_b', x: 0, y: 0, z: 0, size: 1.2, height: 0.2, type: 'otc_base' });
      newBlocks.push({ id: 'otc_l', x: 0, y: 0, z: lidZ, size: 1.2, height: 0.1, type: otcType, glow: otcGlow });

      if (t < 0.3) {
        newBlocks.push({ id: 'msg_u1', x: lerp(-3, 0, t / 0.3), y: 0, z: 0.4, size: 0.4, height: 0.4, type: 'whale', glow: true });
      } else if (t >= 0.3 && t < 0.65) {
        newBlocks.push({ id: 'msg_u_cap', x: 0, y: 0, z: 0.2, size: 0.4, height: 0.4, type: 'whale', glow: true });
      } else if (t >= 0.65 && t < 0.85) {
        newBlocks.push({ id: 'msg_u2', x: lerp(0, 3, (t - 0.65) / 0.2), y: 0, z: 0.4, size: 0.4, height: 0.4, type: 'whale', glow: true });
      }
      if (t > 0.4 && t < 0.6) {
        newBlocks.push({ id: 'msg_otc', x: lerp(0, 3, (t - 0.4) / 0.2), y: 0, z: 0.4, size: 0.4, height: 0.4, type: 'predator', glow: true });
      }
    }

    return newBlocks.sort((a, b) => {
      // In isometric projection, elements that are strictly above others (higher Z)
      // must be drawn AFTER the elements underneath them.
      const depthA = a.x + a.y + (a.z * 2);
      const depthB = b.x + b.y + (b.z * 2);
      return depthA - depthB;
    });
  }, [displayTab, time]);

  return (
    <div className="absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none">
      <div 
        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] blur-[100px] transition-all duration-700 ease-in-out
          ${isExiting ? 'opacity-0 scale-50' : 'opacity-10 scale-100'}
        `}
        style={{
          background: displayTab === -1 ? 'radial-gradient(circle, #3f3f46 0%, transparent 70%)' :
                      displayTab === 0 ? 'radial-gradient(circle, #ffffff 0%, transparent 70%)' :
                      displayTab === 1 ? 'radial-gradient(circle, #a1a1aa 0%, transparent 70%)' :
                                        'radial-gradient(circle, #52525b 0%, transparent 70%)'
        }}
      />
      
      <svg 
        viewBox="-400 -250 800 500" 
        className={`w-full h-full relative z-10 drop-shadow-2xl transition-all duration-700 ease-[cubic-bezier(0.4,0,0.2,1)]
          ${isExiting ? 'scale-75 opacity-0 translate-y-12 blur-sm rotate-[6deg]' : 'scale-100 opacity-100 translate-y-0 blur-0 rotate-0'}
        `}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        <g transform="translate(0, 0)">
          {blocks.map(block => (
            <IsoBlock key={block.id} {...block} size={size} />
          ))}
        </g>
      </svg>
    </div>
  );
};

export default function ProblemSection() {
  const [activeTab, setActiveTab] = useState(-1); // -1 is the Header/Intro state
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const headerRef = useRef<HTMLDivElement>(null);
  
  // Cinematic Flow States
  const [displayTab, setDisplayTab] = useState(-1);
  const [isExiting, setIsExiting] = useState(false);
  const [time, setTime] = useState(0);

  // Mutable refs to prevent stale closures in the animation loop
  const stateRef = useRef({
    activeTab: -1, sceneTime: 0
  });

  useEffect(() => {
    stateRef.current.activeTab = activeTab;
  }, [activeTab]);

  // Scroll Tracking Logic for Scrollytelling
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = parseInt(entry.target.getAttribute('data-index') || '-1', 10);
            setActiveTab(index);
          }
        });
      },
      // Trigger when the card is roughly in the middle of the viewport
      { rootMargin: '-40% 0px -40% 0px' } 
    );

    const currentCards = cardRefs.current;
    const currentHeader = headerRef.current;
    
    if (currentHeader) observer.observe(currentHeader);
    currentCards.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => {
      if (currentHeader) observer.unobserve(currentHeader);
      currentCards.forEach((ref) => {
        if (ref) observer.unobserve(ref);
      });
    };
  }, []);

  // Tab Transition Logic
  useEffect(() => {
    if (displayTab !== activeTab) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsExiting(true);
      const timer = setTimeout(() => {
        setDisplayTab(activeTab);
        stateRef.current.sceneTime = 0; // Fresh start for cinematic mode
        setIsExiting(false);
      }, 500); // Sink and dissolve duration
      return () => clearTimeout(timer);
    }
  }, [activeTab, displayTab]);

  // Global Engine Loop
  useEffect(() => {
    let lastTime = performance.now();
    let animId: number;

    const loop = (now: number) => {
      const dt = now - lastTime;
      lastTime = now;
      
      // Time flows continuously forward
      stateRef.current.sceneTime += dt;
      setTime(stateRef.current.sceneTime);

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  const tabs = [
    { id: 0, title: "Front-Running", subtitle: "Public mempools expose intent.", desc: "Predators monitor public queues. When a large trade is detected, they instantly place smaller, faster transactions ahead of it, artificially inflating the asset price before your trade executes." },
    { id: 1, title: "Information Leakage", subtitle: "Large orders signal market direction.", desc: "When a massive block trade hits an exchange, the surrounding market instantly reacts. The data 'leaks' out, causing the underlying structure to slip, increasing your execution cost dynamically." },
    { id: 2, title: "Counterparty Risk", subtitle: "OTC desks require trust.", desc: "Routing through traditional intermediaries forces you to reveal your hand. Malicious gatekeepers can exploit this asymmetric information, trading against you before forwarding your order." }
  ];

  return (
    <section className="relative w-full bg-[#050505] text-zinc-200 font-sans problem-section">
      
      {/* Full-width Centered Header Section */}
      <header 
        ref={headerRef} 
        data-index="-1"
        className="min-h-screen flex flex-col items-center justify-center text-center max-w-4xl mx-auto px-4 md:px-8"
      >
        <div className="inline-block px-4 py-1.5 mb-6 rounded-full border border-white/10 bg-white/5 text-xs font-semibold tracking-widest uppercase text-white/60 backdrop-blur-md problem-title">
          System Vulnerabilities
        </div>
        <h2 className="text-5xl md:text-7xl font-medium tracking-tight text-white mb-6 leading-tight problem-title">
          The Block Trade Dilemma
        </h2>
        <p className="text-white/60 text-lg md:text-xl leading-relaxed max-w-2xl mx-auto font-mono problem-text">
          Navigating dark pools and public ledgers involves mitigating three core systemic risks inherent to block transactions. Scroll to explore the mechanics of trade extraction.
        </p>
      </header>

      {/* Scrollytelling Section */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row relative items-start px-4 md:px-8 pb-[20vh] md:pb-[50vh]">
        
        {/* Right Column: Sticky Visualization */}
        <div className="w-full md:w-7/12 sticky top-4 md:top-0 h-[45vh] md:h-screen flex items-center justify-center pt-4 md:py-8 md:pl-12 order-1 md:order-2 z-10">
          <div className="w-full h-full max-h-[800px] relative bg-[#0a0a0a] rounded-2xl shadow-2xl border border-white/5 overflow-hidden flex items-center justify-center">
            <Visualizer displayTab={displayTab} time={time} isExiting={isExiting} />
          </div>
        </div>

        {/* Left Column: Scrolling Content */}
        <div className="w-full md:w-5/12 z-20 order-2 md:order-1 pt-[10vh] md:pt-[20vh]">
          
          <div className="flex flex-col gap-[40vh] md:gap-[60vh]">
            {tabs.map((tab, idx) => (
              <div
                key={tab.id}
                ref={(el) => { cardRefs.current[idx] = el; }}
                data-index={idx}
                className={`relative p-8 md:p-10 rounded-3xl border transition-all duration-700 ease-out backdrop-blur-md
                  ${activeTab === idx 
                    ? 'bg-white/5 border-white/10 shadow-2xl scale-100 opacity-100' 
                    : 'bg-transparent border-transparent scale-95 opacity-30'
                  }
                `}
              >
                {/* Active Indicator Line */}
                <div className={`absolute left-0 top-1/4 bottom-1/4 w-1 rounded-r-xl transition-all duration-500 ${activeTab === idx ? 'bg-white opacity-100' : 'opacity-0'}`} />
                
                <div className="flex flex-col mb-6">
                  <span className={`font-mono text-5xl md:text-6xl font-light tracking-tighter mb-4 transition-colors ${activeTab === idx ? 'text-white' : 'text-white/40'}`}>
                    0{idx + 1}
                  </span>
                  <h3 className={`font-medium text-3xl md:text-4xl tracking-tight transition-colors ${activeTab === idx ? 'text-white' : 'text-white/60'}`}>
                    {tab.title}
                  </h3>
                </div>
                
                <h4 className={`text-lg md:text-xl font-mono mb-4 transition-colors ${activeTab === idx ? 'text-white/80' : 'text-white/40'}`}>
                  {tab.subtitle}
                </h4>
                
                <p className={`text-base md:text-lg leading-relaxed transition-colors ${activeTab === idx ? 'text-white/60' : 'text-white/30'}`}>
                  {tab.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
