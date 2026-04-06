"use client";

import React from 'react';
import { motion } from 'motion/react';
import { iso, CX, CY, IsoPath, IsoLine, IsoBox, getIsoOffset } from './iso-utils';

export default function SmartContractFactory({ className = "w-full h-full" }: { className?: string }) {
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

        {/* FACTORY FLOOR */}
        <g id="layer-factory-floor">
          <IsoBox x={-200} y={-200} z={-10} w={400} d={400} h={10} styleType="ghost" />
        </g>

        {/* ASSEMBLY LINE PIPES */}
        <g id="layer-pipes">
          <IsoPath points={[[-250, 0, 10], [-100, 0, 10], [-100, 0, 50], [0, 0, 50]]} stroke="rgba(255,255,255,0.3)" strokeWidth={2} />
          <IsoPath points={[[0, 0, 50], [100, 0, 50], [100, 100, 50], [250, 100, 50]]} stroke="rgba(255,255,255,0.3)" strokeWidth={2} />
          <IsoPath points={[[0, 0, 50], [100, 0, 50], [100, -100, 50], [250, -100, 50]]} stroke="rgba(255,255,255,0.3)" strokeWidth={2} />
        </g>

        {/* DATA PACKETS */}
        <g id="layer-data-packets">
          <motion.g
            initial={{ opacity: 0 }}
            animate={{ 
              x: [getIsoOffset(-250, 0, 10).x, getIsoOffset(-100, 0, 10).x, getIsoOffset(-100, 0, 50).x, getIsoOffset(0, 0, 50).x],
              y: [getIsoOffset(-250, 0, 10).y, getIsoOffset(-100, 0, 10).y, getIsoOffset(-100, 0, 50).y, getIsoOffset(0, 0, 50).y],
              opacity: [0, 1, 1, 0]
            }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          >
            <IsoBox x={-5} y={-5} z={-5} w={10} d={10} h={10} styleType="node" />
          </motion.g>
          
          <motion.g
            initial={{ opacity: 0 }}
            animate={{ 
              x: [getIsoOffset(0, 0, 50).x, getIsoOffset(100, 0, 50).x, getIsoOffset(100, 100, 50).x, getIsoOffset(250, 100, 50).x],
              y: [getIsoOffset(0, 0, 50).y, getIsoOffset(100, 0, 50).y, getIsoOffset(100, 100, 50).y, getIsoOffset(250, 100, 50).y],
              opacity: [0, 1, 1, 0]
            }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear", delay: 3 }}
          >
            <IsoBox x={-5} y={-5} z={-5} w={10} d={10} h={10} styleType="core" />
          </motion.g>
          
          <motion.g
            initial={{ opacity: 0 }}
            animate={{ 
              x: [getIsoOffset(0, 0, 50).x, getIsoOffset(100, 0, 50).x, getIsoOffset(100, -100, 50).x, getIsoOffset(250, -100, 50).x],
              y: [getIsoOffset(0, 0, 50).y, getIsoOffset(100, 0, 50).y, getIsoOffset(100, -100, 50).y, getIsoOffset(250, -100, 50).y],
              opacity: [0, 1, 1, 0]
            }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear", delay: 4.5 }}
          >
            <IsoBox x={-5} y={-5} z={-5} w={10} d={10} h={10} styleType="core" />
          </motion.g>
        </g>

        {/* LOGIC GATES AND MACHINES */}
        <g id="layer-machines">
          {/* Input Processor */}
          <IsoBox x={-120} y={-20} z={0} w={40} d={40} h={60} styleType="inner" />
          
          {/* Central Splitter (If/Else) */}
          <IsoBox x={-20} y={-20} z={40} w={40} d={40} h={20} styleType="core" />
          
          {/* Output Processor A */}
          <IsoBox x={80} y={80} z={40} w={40} d={40} h={20} styleType="node" />
          
          {/* Output Processor B */}
          <IsoBox x={80} y={-120} z={40} w={40} d={40} h={20} styleType="node" />
        </g>

      </svg>
    </div>
  );
}
