"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { iso, CX, CY, IsoLine, IsoBox, getIsoOffset } from './iso-utils';

export default function PosConsensus({ className = "w-full h-full" }: { className?: string }) {
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

  const [phase, setPhase] = useState<'idle' | 'proposing' | 'attesting' | 'consensus'>('idle');

  useEffect(() => {
    const sequence = async () => {
      while (true) {
        setPhase('idle');
        await new Promise(r => setTimeout(r, 1000));
        setPhase('proposing');
        await new Promise(r => setTimeout(r, 1500));
        setPhase('attesting');
        await new Promise(r => setTimeout(r, 1500));
        setPhase('consensus');
        await new Promise(r => setTimeout(r, 1500));
      }
    };
    sequence();
  }, []);

  const nodes = [
    { id: 'n1', x: 0, y: 0, z: 20, s: 40, role: 'proposer' },
    { id: 'n2', x: 150, y: 100, z: 10, s: 20, role: 'validator' },
    { id: 'n3', x: -120, y: 180, z: 15, s: 30, role: 'validator' },
    { id: 'n4', x: -200, y: -50, z: 5, s: 15, role: 'validator' },
    { id: 'n5', x: 100, y: -150, z: 25, s: 35, role: 'validator' },
    { id: 'n6', x: 250, y: -50, z: 10, s: 20, role: 'validator' },
    { id: 'n7', x: -80, y: -200, z: 15, s: 25, role: 'validator' },
  ];

  const connections = [
    ['n1', 'n2'], ['n1', 'n3'], ['n1', 'n4'], ['n1', 'n5'],
    ['n2', 'n6'], ['n5', 'n6'], ['n4', 'n7'], ['n5', 'n7'], ['n3', 'n4']
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
        </g>

        {/* CONNECTIONS */}
        <g id="layer-connections">
          {connections.map(([id1, id2], i) => {
            const n1 = nodes.find(n => n.id === id1)!;
            const n2 = nodes.find(n => n.id === id2)!;
            
            // Base line
            const p1: [number, number, number] = [n1.x, n1.y, n1.z];
            const p2: [number, number, number] = [n2.x, n2.y, n2.z];
            
            const isProposerConnection = n1.role === 'proposer' || n2.role === 'proposer';

            return (
              <g key={`conn-${i}`}>
                <IsoLine p1={p1} p2={p2} stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
                
                {/* Proposal Pulse */}
                {isProposerConnection && (
                  <motion.g
                    initial={{ opacity: 0 }}
                    animate={{ opacity: phase === 'proposing' ? [0, 1, 0] : 0 }}
                    transition={{ duration: 1, repeat: phase === 'proposing' ? Infinity : 0 }}
                  >
                    <IsoLine p1={p1} p2={p2} stroke="rgba(255,255,255,0.8)" strokeWidth={2} filter="url(#neon-glow-intense)" dash="4 4" />
                  </motion.g>
                )}

                {/* Attestation Pulse */}
                {!isProposerConnection && (
                  <motion.g
                    initial={{ opacity: 0 }}
                    animate={{ opacity: phase === 'attesting' ? [0, 1, 0] : 0 }}
                    transition={{ duration: 1, repeat: phase === 'attesting' ? Infinity : 0 }}
                  >
                    <IsoLine p1={p1} p2={p2} stroke="rgba(255,255,255,0.5)" strokeWidth={1.5} filter="url(#neon-glow)" dash="2 4" />
                  </motion.g>
                )}
              </g>
            );
          })}
        </g>

        {/* NODES */}
        <g id="layer-nodes">
          {nodes.map((node) => {
            let styleType: 'node' | 'core' | 'verified' = 'node';
            
            if (phase === 'consensus') {
              styleType = 'verified';
            } else if (node.role === 'proposer' && phase === 'proposing') {
              styleType = 'core';
            } else if (node.role === 'validator' && phase === 'attesting') {
              styleType = 'core';
            }

            return (
              <motion.g
                key={node.id}
                animate={phase === 'consensus' ? { y: [0, -10, 0] } : { y: 0 }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
              >
                <IsoBox 
                  x={node.x - node.s/2} 
                  y={node.y - node.s/2} 
                  z={node.z} 
                  w={node.s} 
                  d={node.s} 
                  h={node.s} 
                  styleType={styleType} 
                />
              </motion.g>
            );
          })}
        </g>

      </svg>
    </div>
  );
}
