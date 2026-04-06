import React from 'react';

// --- 3D to Isometric Projection Engine ---
export const CX = 500; // Center X of the viewBox
export const CY = 650; // Center Y of the viewBox (shifted down to accommodate height)

// Standard Isometric Constants
export const ISO_COS = 0.866; // Math.cos(30 degrees)
export const ISO_SIN = 0.5;   // Math.sin(30 degrees)

/**
 * Maps 3D coordinates (x, y, z) to 2D isometric screen coordinates.
 */
export const iso = (x: number, y: number, z: number): string => {
  const sx = CX + (x - y) * ISO_COS;
  const sy = CY + (x + y) * ISO_SIN - z;
  return `${sx.toFixed(2)},${sy.toFixed(2)}`;
};

export const getIsoOffset = (x: number, y: number, z: number) => {
  const dx = (x - y) * ISO_COS;
  const dy = (x + y) * ISO_SIN - z;
  return { x: dx, y: dy };
};

export interface PolygonProps {
  points: [number, number, number][];
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  filter?: string;
  dash?: string;
  className?: string;
}

export const IsoPolygon: React.FC<PolygonProps> = ({ points, fill = 'none', stroke = '#ffffff', strokeWidth = 1, filter, dash, className }) => (
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

export interface PathProps extends PolygonProps {}

export const IsoPath: React.FC<PathProps> = ({ points, stroke = '#ffffff', strokeWidth = 1, dash, filter, className }) => (
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

export interface LineProps {
  p1: [number, number, number];
  p2: [number, number, number];
  stroke?: string;
  strokeWidth?: number;
  dash?: string;
  filter?: string;
  className?: string;
}

export interface LineProps {
  p1: [number, number, number];
  p2: [number, number, number];
  stroke?: string;
  strokeWidth?: number;
  dash?: string;
  filter?: string;
  className?: string;
}

export const IsoLine: React.FC<LineProps> = ({ p1, p2, stroke = '#ffffff', strokeWidth = 1, dash, filter, className }) => {
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

export interface IsoBoxProps {
  x: number;
  y: number;
  z: number;
  w: number;
  d: number;
  h: number;
  styleType: 'outer' | 'inner' | 'core' | 'node' | 'ghost' | 'shard' | 'verified';
  renderParts?: 'all' | 'back' | 'front';
  className?: string;
}

export const IsoBox: React.FC<IsoBoxProps> = ({ x, y, z, w, d, h, styleType, renderParts = 'all', className }) => {
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
    case 'shard': // Fragmented data shards
      topFill = 'rgba(255,255,255,0.2)';
      sideLFill = 'rgba(255,255,255,0.3)';
      sideRFill = 'rgba(255,255,255,0.1)';
      stroke = 'rgba(255,255,255,0.8)';
      sw = 1;
      filter = 'url(#neon-glow)';
      break;
    case 'verified': // Green verified state
      topFill = 'rgba(16, 185, 129, 0.2)';
      sideLFill = 'rgba(16, 185, 129, 0.3)';
      sideRFill = 'rgba(16, 185, 129, 0.1)';
      stroke = 'rgba(16, 185, 129, 0.9)';
      sw = 2;
      filter = 'url(#neon-glow-green)';
      break;
  }

  return (
    <g className={`iso-box-${styleType} ${className || ''}`}>
      {(renderParts === 'all' || renderParts === 'back') && (
        <g className="box-back-edges">
          <IsoLine p1={p000} p2={p100} stroke={stroke} strokeWidth={sw} dash={dash} className="edge-back-bottom-x" />
          <IsoLine p1={p000} p2={p010} stroke={stroke} strokeWidth={sw} dash={dash} className="edge-back-bottom-y" />
          <IsoLine p1={p000} p2={p001} stroke={stroke} strokeWidth={sw} dash={dash} className="edge-back-vertical" />
        </g>
      )}

      {(renderParts === 'all' || renderParts === 'front') && (
        <g className="box-front-faces">
          <IsoPolygon points={[p100, p110, p111, p101]} fill={sideLFill} stroke={stroke} strokeWidth={sw} filter={filter} dash={dash} className="face-left" />
          <IsoPolygon points={[p010, p110, p111, p011]} fill={sideRFill} stroke={stroke} strokeWidth={sw} filter={filter} dash={dash} className="face-right" />
          <IsoPolygon points={[p001, p101, p111, p011]} fill={topFill} stroke={stroke} strokeWidth={sw} filter={filter} dash={dash} className="face-top" />
        </g>
      )}
    </g>
  );
};
