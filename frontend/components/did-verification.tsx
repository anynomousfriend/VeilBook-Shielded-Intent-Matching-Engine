"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { iso, CX, CY, IsoPolygon, IsoPath, IsoLine, IsoBox, getIsoOffset } from './iso-utils';

export default function DidVerification({ className = "w-full h-full" }: { className?: string }) {
  // Generate Background Grid Array
  const gridLines = [];
  const gridSize = 400;
  const gridStep = 40;
  for (let i = -gridSize; i <= gridSize; i += gridStep) {
    gridLines.push(
      <IsoLine key={`x${i}`} p1={[i, -gridSize, 0]} p2={[i, gridSize, 0]} stroke="rgba(255,255,255,0.05)" className="grid-line" />
    );
    gridLines.push(
      <IsoLine key={`y${i}`} p1={[-gridSize, i, 0]} p2={[gridSize, i, 0]} stroke="rgba(255,255,255,0.05)" className="grid-line" />
    );
  }

  // Animation state
  const [phase, setPhase] = useState<'idle' | 'verifying' | 'verified'>('idle');

  useEffect(() => {
    const sequence = async () => {
      while (true) {
        setPhase('idle');
        await new Promise(r => setTimeout(r, 2000));
        setPhase('verifying');
        await new Promise(r => setTimeout(r, 2000));
        setPhase('verified');
        await new Promise(r => setTimeout(r, 2000));
      }
    };
    sequence();
  }, []);

  // Shard positions (scattered vs assembled)
  const shards = [
    { id: 1, scatter: [-100, 150, 80], assemble: [-20, -20, 60] },
    { id: 2, scatter: [120, -100, 120], assemble: [20, -20, 60] },
    { id: 3, scatter: [-150, -80, 40], assemble: [-20, 20, 60] },
    { id: 4, scatter: [80, 120, 150], assemble: [20, 20, 60] },
    { id: 5, scatter: [0, -180, 90], assemble: [0, 0, 80] },
    { id: 6, scatter: [-180, 0, 100], assemble: [0, 0, 40] },
  ];

  return (
    <div className={`relative flex items-center justify-center bg-[#070709] overflow-hidden ${className}`}>
      <svg 
        viewBox="0 0 1000 1000" 
        className="w-full h-full max-w-5xl"
        preserveAspectRatio="xMidYMid meet"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="neon-glow-intense" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="blur1" />
            <feGaussianBlur stdDeviation="2" result="blur2" />
            <feMerge>
              <feMergeNode in="blur1" />
              <feMergeNode in="blur2" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="neon-glow-green" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="blur1" />
            <feGaussianBlur stdDeviation="2" result="blur2" />
            <feColorMatrix type="matrix" values="0 0 0 0 0.06   0 0 0 0 0.72   0 0 0 0 0.5   0 0 0 1 0" result="green-glow" />
            <feMerge>
              <feMergeNode in="green-glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* BACKGROUND */}
        <g id="layer-background-grid">
          <motion.g
            animate={{ x: [-20, 20, -20], y: [-10, 10, -10] }}
            transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
          >
            {gridLines}
          </motion.g>
          <IsoBox x={-150} y={-150} z={-10} w={300} d={300} h={10} styleType="ghost" />
        </g>

        {/* INCOMING REQUEST BEAM */}
        <g id="layer-request-beam">
          <motion.g
            initial={{ opacity: 0 }}
            animate={{ opacity: phase === 'verifying' ? [0, 1, 0] : 0 }}
            transition={{ duration: 1, repeat: phase === 'verifying' ? Infinity : 0 }}
          >
            <IsoLine p1={[0, 300, 200]} p2={[0, 0, 50]} stroke="rgba(255,255,255,0.8)" strokeWidth={2} filter="url(#neon-glow-intense)" dash="10 10" />
          </motion.g>
        </g>

        {/* CENTRAL IDENTITY CORE */}
        <g id="layer-identity-core">
          <IsoBox x={-40} y={-40} z={0} w={80} d={80} h={40} styleType="outer" renderParts="back" />
          <IsoBox x={-20} y={-20} z={10} w={40} d={40} h={20} styleType="core" />
          
          {/* Verified Pulse */}
          <motion.g
            initial={{ opacity: 0, scale: 0.8 }}
            animate={phase === 'verified' ? { opacity: [0, 1, 0], scale: [0.8, 1.5, 2] } : { opacity: 0, scale: 0.8 }}
            transition={{ duration: 1, ease: "easeOut" }}
            style={{ transformOrigin: `${CX}px ${CY}px` }}
          >
            <IsoBox x={-60} y={-60} z={-5} w={120} d={120} h={50} styleType="verified" />
          </motion.g>

          <IsoBox x={-40} y={-40} z={0} w={80} d={80} h={40} styleType="outer" renderParts="front" />
        </g>

        {/* FLOATING SHARDS */}
        <g id="layer-shards">
          {shards.map((shard) => {
            const isAssembled = phase === 'verifying' || phase === 'verified';
            const targetPos = isAssembled ? shard.assemble : shard.scatter;
            const offset = getIsoOffset(targetPos[0], targetPos[1], targetPos[2]);
            
            return (
              <motion.g
                key={shard.id}
                initial={false}
                animate={{ x: offset.x, y: offset.y }}
                transition={{ duration: 0.8, type: "spring", bounce: 0.2 }}
              >
                {/* Shard is just a small box drawn at 0,0,0 and translated */}
                <IsoBox x={-10} y={-10} z={-10} w={20} d={20} h={20} styleType={phase === 'verified' ? 'verified' : 'shard'} />
              </motion.g>
            );
          })}
        </g>

      </svg>
    </div>
  );
}
