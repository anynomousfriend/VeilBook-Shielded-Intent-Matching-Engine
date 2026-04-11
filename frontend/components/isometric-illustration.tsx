"use client";

import React from 'react';
import { motion } from 'motion/react';

/**
 * Shielded Intent Matching Engine on Midnight Network - Isometric Illustration
 * 
 * This component renders a pure, raw SVG using mathematical isometric projection.
 * It strictly adheres to a minimalist, dark mode, high-tech wireframe aesthetic.
 * * DOM Structure is logically grouped for easy GSAP / CSS animation targeting.
 * No external libraries are used. All rendering is derived from the custom `iso()` math helper.
 */

// --- 3D to Isometric Projection Engine ---
const CX = 500; // Center X of the viewBox
const CY = 650; // Center Y of the viewBox (shifted down to accommodate height)

// Standard Isometric Constants
const ISO_COS = 0.866; // Math.cos(30 degrees)
const ISO_SIN = 0.5;   // Math.sin(30 degrees)

/**
 * Maps 3D coordinates (x, y, z) to 2D isometric screen coordinates.
 * - +X axis goes down-right
 * - +Y axis goes down-left
 * - +Z axis goes straight up
 */
const iso = (x: number, y: number, z: number): string => {
  const sx = CX + (x - y) * ISO_COS;
  const sy = CY + (x + y) * ISO_SIN - z;
  return `${sx.toFixed(2)},${sy.toFixed(2)}`;
};

// --- Helper Components for Geometric Primitives ---

interface PolygonProps {
  points: [number, number, number][];
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  filter?: string;
  dash?: string;
  className?: string;
}

const IsoPolygon: React.FC<PolygonProps> = ({ points, fill = 'none', stroke = '#ffffff', strokeWidth = 1, filter, dash, className }) => (
  <polygon
    points={points.map(p => iso(...p)).join(' ')}
    fill={fill}
    stroke={stroke}
    strokeWidth={strokeWidth}
    filter={filter}
    strokeDasharray={dash}
    className={className}
    strokeLinejoin="round"
  />
);

interface PathProps extends PolygonProps {}

const IsoPath: React.FC<PathProps> = ({ points, stroke = '#ffffff', strokeWidth = 1, dash, filter, className }) => (
  <polyline
    points={points.map(p => iso(...p)).join(' ')}
    fill="none"
    stroke={stroke}
    strokeWidth={strokeWidth}
    strokeDasharray={dash}
    filter={filter}
    className={className}
    strokeLinejoin="round"
    strokeLinecap="round"
  />
);

interface LineProps {
  p1: [number, number, number];
  p2: [number, number, number];
  stroke?: string;
  strokeWidth?: number;
  dash?: string;
  filter?: string;
  className?: string;
}

const IsoLine: React.FC<LineProps> = ({ p1, p2, stroke = '#ffffff', strokeWidth = 1, dash, filter, className }) => {
  const [x1, y1] = iso(...p1).split(',');
  const [x2, y2] = iso(...p2).split(',');
  return (
    <line
      x1={x1} y1={y1} x2={x2} y2={y2}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeDasharray={dash}
      filter={filter}
      className={className}
      strokeLinecap="round"
    />
  );
};

// --- Complex Isometric Shape Builders ---

const getIsoOffset = (x: number, y: number, z: number) => {
  const dx = (x - y) * ISO_COS;
  const dy = (x + y) * ISO_SIN - z;
  return { x: dx, y: dy };
};

interface AnimatedPacketProps {
  path: [number, number, number][];
  delay?: number;
  duration?: number;
  className?: string;
}

const AnimatedPacket: React.FC<AnimatedPacketProps> = ({ path, delay = 0, duration = 4, className }) => {
  let totalLength = 0;
  const lengths = [0];
  for (let i = 1; i < path.length; i++) {
    const [x1, y1, z1] = path[i - 1];
    const [x2, y2, z2] = path[i];
    const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2 + (z2 - z1) ** 2);
    totalLength += dist;
    lengths.push(totalLength);
  }
  const times = lengths.map(l => l / totalLength);

  const xKeyframes = path.map(p => getIsoOffset(...p).x);
  const yKeyframes = path.map(p => getIsoOffset(...p).y);
  const opacityKeyframes = path.map((_, i) => (i === 0 || i === path.length - 1) ? 0 : 1);

  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ x: xKeyframes, y: yKeyframes, opacity: opacityKeyframes }}
      transition={{
        duration,
        repeat: Infinity,
        ease: "linear",
        times,
        delay,
      }}
    >
      <IsoBox x={-5} y={-5} z={-5} w={10} d={10} h={10} styleType="outer" className={className} />
    </motion.g>
  );
};

interface IsoBoxProps {
  x: number;
  y: number;
  z: number;
  w: number;
  d: number;
  h: number;
  styleType: 'outer' | 'inner' | 'core' | 'node' | 'ghost';
  renderParts?: 'all' | 'back' | 'front';
  className?: string;
}

const IsoBox: React.FC<IsoBoxProps> = ({ x, y, z, w, d, h, styleType, renderParts = 'all', className }) => {
  // Define the 8 corners of the box
  const p000: [number, number, number] = [x, y, z];
  const p100: [number, number, number] = [x + w, y, z];
  const p110: [number, number, number] = [x + w, y + d, z];
  const p010: [number, number, number] = [x, y + d, z];
  const p001: [number, number, number] = [x, y, z + h];
  const p101: [number, number, number] = [x + w, y, z + h];
  const p111: [number, number, number] = [x + w, y + d, z + h];
  const p011: [number, number, number] = [x, y + d, z + h];

  // Apply visual styling based on layer type
  let topFill, sideLFill, sideRFill, stroke, sw, dash, filter;
  
  switch (styleType) {
    case 'outer': // The transparent Dark Pool wrapper
      topFill = 'rgba(255,255,255,0.015)';
      sideLFill = 'rgba(255,255,255,0.03)';
      sideRFill = 'rgba(255,255,255,0.01)';
      stroke = 'rgba(255,255,255,0.3)';
      sw = 1;
      break;
    case 'inner': // The Zero-Knowledge Shield
      topFill = 'rgba(255,255,255,0.05)';
      sideLFill = 'rgba(255,255,255,0.08)';
      sideRFill = 'rgba(255,255,255,0.04)';
      stroke = 'rgba(255,255,255,0.7)';
      sw = 1.5;
      filter = 'url(#neon-glow)';
      break;
    case 'core': // The Matching Engine
      topFill = 'rgba(255,255,255,0.15)';
      sideLFill = 'rgba(255,255,255,0.2)';
      sideRFill = 'rgba(255,255,255,0.1)';
      stroke = '#ffffff';
      sw = 2;
      filter = 'url(#neon-glow-intense)';
      break;
    case 'node': // Cryptographic Nodes
      topFill = 'rgba(255,255,255,0.1)';
      sideLFill = 'rgba(255,255,255,0.15)';
      sideRFill = 'rgba(255,255,255,0.05)';
      stroke = 'rgba(255,255,255,0.9)';
      sw = 1;
      filter = 'url(#neon-glow)';
      break;
    case 'ghost': // Base pads
      topFill = 'transparent';
      sideLFill = 'transparent';
      sideRFill = 'transparent';
      stroke = 'rgba(255,255,255,0.15)';
      dash = '3 3';
      sw = 1;
      break;
  }

  return (
    <g className={`iso-box-${styleType} ${className || ''}`}>
      {(renderParts === 'all' || renderParts === 'back') && (
        <g className="box-back-edges">
          {/* Back edges - rendered first for correct z-indexing */}
          <IsoLine p1={p000} p2={p100} stroke={stroke} strokeWidth={sw} dash={dash} className="edge-back-bottom-x" />
          <IsoLine p1={p000} p2={p010} stroke={stroke} strokeWidth={sw} dash={dash} className="edge-back-bottom-y" />
          <IsoLine p1={p000} p2={p001} stroke={stroke} strokeWidth={sw} dash={dash} className="edge-back-vertical" />
        </g>
      )}

      {(renderParts === 'all' || renderParts === 'front') && (
        <g className="box-front-faces">
          {/* Left Visual Face (spans along +Y axis) */}
          <IsoPolygon points={[p100, p110, p111, p101]} fill={sideLFill} stroke={stroke} strokeWidth={sw} filter={filter} dash={dash} className="face-left" />
          {/* Right Visual Face (spans along +X axis) */}
          <IsoPolygon points={[p010, p110, p111, p011]} fill={sideRFill} stroke={stroke} strokeWidth={sw} filter={filter} dash={dash} className="face-right" />
          {/* Top Visual Face */}
          <IsoPolygon points={[p001, p101, p111, p011]} fill={topFill} stroke={stroke} strokeWidth={sw} filter={filter} dash={dash} className="face-top" />
        </g>
      )}
    </g>
  );
};

// --- Main Illustration Component ---

export default function IsometricIllustration({ className = "w-full h-full" }: { className?: string }) {
  // Generate Background Grid Array
  const gridLines = [];
  const gridSize = 400;
  const gridStep = 40;
  for (let i = -gridSize; i <= gridSize; i += gridStep) {
    gridLines.push(
      <IsoLine key={`x${i}`} p1={[i, -gridSize, 0]} p2={[i, gridSize, 0]} stroke="rgba(255,255,255,0.08)" className="grid-line" />
    );
    gridLines.push(
      <IsoLine key={`y${i}`} p1={[-gridSize, i, 0]} p2={[gridSize, i, 0]} stroke="rgba(255,255,255,0.08)" className="grid-line" />
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
          {/* Subtle Glow Filter for outer shells */}
          <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Intense Glow Filter for the central core & nodes */}
          <filter id="neon-glow-intense" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="blur1" />
            <feGaussianBlur stdDeviation="2" result="blur2" />
            <feMerge>
              <feMergeNode in="blur1" />
              <feMergeNode in="blur2" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Deep shadow for the base pad */}
          <filter id="floor-shadow">
            <feGaussianBlur stdDeviation="15" result="blur" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.5"/>
            </feComponentTransfer>
          </filter>
        </defs>

        {/* 1. BACKGROUND LAYER */}
        <g id="layer-background-grid">
          <motion.g
            animate={{ x: [-40, 40, -40], y: [-20, 20, -20] }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          >
            {gridLines}
          </motion.g>
          
          {/* Base structure pad marking the pool territory */}
          <IsoBox x={-125} y={-125} z={-10} w={250} d={250} h={10} styleType="ghost" />
          <IsoBox x={-180} y={-180} z={-5} w={360} d={360} h={5} styleType="ghost" className="opacity-50" />
        </g>

        {/* 2. MIDNIGHT NETWORK ORBITAL RINGS */}
        <g id="layer-orbital-rings">
          {/* Ellipses mapped to isometric floor (rx/ry ratio = 0.577) */}
          <ellipse cx={CX} cy={CY} rx={380} ry={380 * 0.577} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          <motion.ellipse 
            cx={CX} cy={CY} rx={320} ry={320 * 0.577} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" strokeDasharray="6 8" 
            animate={{ strokeDashoffset: [0, -140] }}
            transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
          />
          <motion.ellipse 
            cx={CX} cy={CY - 40} rx={240} ry={240 * 0.577} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="2 4" 
            animate={{ strokeDashoffset: [0, 60] }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          />
          <motion.ellipse 
            cx={CX} cy={CY - 120} rx={160} ry={160 * 0.577} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="1 6" filter="url(#neon-glow)" 
            animate={{ strokeDashoffset: [0, -70] }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          />
        </g>

        {/* 3. BACKGROUND DATA FLOWS & NODES */}
        <g id="layer-back-elements">
          {/* Rear Cryptographic Node */}
          <IsoPath points={[[-160, -120, 160], [-160, -120, 60], [-40, -120, 60], [-40, -40, 60]]} stroke="rgba(255,255,255,0.4)" dash="4 4" filter="url(#neon-glow)" />
          <IsoBox x={-170} y={-130} z={160} w={20} d={20} h={5} styleType="node" />
          <IsoBox x={-166} y={-126} z={165} w={12} d={12} h={15} styleType="core" />
        </g>

        {/* 4. THE INTENT ENGINE (OUTER SHELL - BACK EDGES) */}
        <g id="layer-pool-outer-back">
          <IsoBox x={-80} y={-80} z={0} w={160} d={160} h={100} styleType="outer" renderParts="back" />
        </g>

        {/* 5. THE ZK SHIELD (INNER SHELL - BACK EDGES) */}
        <g id="layer-pool-inner-back">
          <IsoBox x={-40} y={-40} z={20} w={80} d={80} h={130} styleType="inner" renderParts="back" />
        </g>

        {/* 6. CENTRAL MATCHING ENGINE CORE */}
        <g id="layer-core-engine">
          {/* Core Base Mount */}
          <IsoBox x={-20} y={-20} z={40} w={40} d={40} h={10} styleType="outer" />
          {/* Main Glowing Engine Array */}
          <IsoBox x={-15} y={-15} z={50} w={30} d={30} h={70} styleType="core" />
          {/* Vertical energy beam through core */}
          <IsoLine p1={[0, 0, 0]} p2={[0, 0, 220]} stroke="rgba(255,255,255,0.8)" strokeWidth={2} dash="4 6" filter="url(#neon-glow-intense)" />
          {/* Central Processor Node */}
          <IsoBox x={-5} y={-5} z={80} w={10} d={10} h={10} styleType="node" />
        </g>

        {/* 7. THE ZK SHIELD (INNER SHELL - FRONT FACES) */}
        <g id="layer-pool-inner-front">
          {/* ZK Shield encapsulates the core, applying the privacy layer */}
          <IsoBox x={-40} y={-40} z={20} w={80} d={80} h={130} styleType="inner" renderParts="front" />
          {/* Cryptographic lock visual on inner shield */}
          <IsoPolygon points={[[-40, -10, 85], [-40, 10, 85], [-40, 0, 100]]} fill="rgba(255,255,255,0.3)" stroke="#fff" filter="url(#neon-glow)" />
          <IsoPolygon points={[[-10, -40, 85], [10, -40, 85], [0, -40, 100]]} fill="rgba(255,255,255,0.1)" stroke="#fff" filter="url(#neon-glow)" />
        </g>

        {/* 8. FOREGROUND DATA PIPELINES (ORDER FLOW) */}
        <g id="layer-data-pipelines">
          {/* Taker Flow (Originates from Left side / +Y axis) */}
          {/* Outside Pool: Clear Order Data */}
          <IsoPath points={[[0, 260, 10], [0, 120, 10], [0, 120, 60], [0, 80, 60]]} stroke="rgba(255,255,255,0.5)" strokeWidth={1.5} />
          <AnimatedPacket path={[[0, 260, 10], [0, 120, 10], [0, 120, 60], [0, 80, 60]]} delay={0} duration={4} className="taker-packet-1" />
          <AnimatedPacket path={[[0, 260, 10], [0, 120, 10], [0, 120, 60], [0, 80, 60]]} delay={2} duration={4} className="taker-packet-2" />
          {/* Inside Outer Pool: Shielding Begins */}
          <IsoPath points={[[0, 80, 60], [0, 40, 60]]} stroke="rgba(255,255,255,0.6)" strokeWidth={1.5} dash="3 3" />
          {/* Inside ZK Shield: Fully Encrypted/Zero-Knowledge Proof */}
          <IsoPath points={[[0, 40, 60], [0, 15, 60]]} stroke="#ffffff" strokeWidth={2} dash="1 4" filter="url(#neon-glow-intense)" />

          {/* Maker Flow (Originates from Right side / +X axis) */}
          <IsoPath points={[[280, 0, 20], [140, 0, 20], [140, 0, 90], [80, 0, 90]]} stroke="rgba(255,255,255,0.5)" strokeWidth={1.5} />
          <AnimatedPacket path={[[280, 0, 20], [140, 0, 20], [140, 0, 90], [80, 0, 90]]} delay={0} duration={4.5} className="maker-packet-1" />
          <AnimatedPacket path={[[280, 0, 20], [140, 0, 20], [140, 0, 90], [80, 0, 90]]} delay={2.25} duration={4.5} className="maker-packet-2" />
          <IsoPath points={[[80, 0, 90], [40, 0, 90]]} stroke="rgba(255,255,255,0.6)" strokeWidth={1.5} dash="3 3" />
          <IsoPath points={[[40, 0, 90], [15, 0, 90]]} stroke="#ffffff" strokeWidth={2} dash="1 4" filter="url(#neon-glow-intense)" />
        </g>

        {/* 9. THE INTENT ENGINE (OUTER SHELL - FRONT FACES) */}
        <g id="layer-pool-outer-front">
          {/* This renders over the internal pipelines to submerge them in the engine */}
          <IsoBox x={-80} y={-80} z={0} w={160} d={160} h={100} styleType="outer" renderParts="front" />
        </g>

        {/* 10. FOREGROUND CRYPTOGRAPHIC NODES */}
        <g id="layer-front-nodes">
          {/* Right Floating Node */}
          <IsoPath points={[[-40, 180, 130], [-40, 180, 70], [-40, 80, 70]]} stroke="rgba(255,255,255,0.4)" dash="4 4" filter="url(#neon-glow)" />
          <IsoBox x={-50} y={170} z={130} w={20} d={20} h={5} styleType="node" />
          <IsoBox x={-45} y={175} z={135} w={10} d={10} h={20} styleType="core" />
          
          {/* Left Floating Node */}
          <IsoPath points={[[160, -60, 110], [160, -60, 50], [80, -60, 50], [80, -40, 50]]} stroke="rgba(255,255,255,0.4)" dash="4 4" filter="url(#neon-glow)" />
          <IsoBox x={150} y={-70} z={110} w={20} d={20} h={5} styleType="node" />
          <IsoBox x={155} y={-65} z={115} w={10} d={10} h={15} styleType="core" />
        </g>

      </svg>
    </div>
  );
}
