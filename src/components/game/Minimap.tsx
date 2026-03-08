import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { getTrackPath, getTrackBounds } from './Track';

interface MinimapProps {
  carPositions: Map<string, THREE.Vector3>;
  playerPosition: THREE.Vector3 | null;
  trackWidth?: number;
}

export const Minimap = ({ carPositions, playerPosition, trackWidth = 10 }: MinimapProps) => {
  const { trackPoints, bounds } = useMemo(() => {
    const curve = getTrackPath();
    const points = curve.getPoints(200);
    const { innerPoints, outerPoints } = getTrackBounds(trackWidth);
    
    // Find bounds for normalization
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    [...innerPoints, ...outerPoints].forEach(p => {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z);
      maxZ = Math.max(maxZ, p.z);
    });
    
    const padding = 5;
    return {
      trackPoints: points,
      bounds: { 
        minX: minX - padding, maxX: maxX + padding, 
        minZ: minZ - padding, maxZ: maxZ + padding 
      }
    };
  }, [trackWidth]);

  const mapSize = 180;
  
  const worldToMap = (x: number, z: number) => {
    const nx = (x - bounds.minX) / (bounds.maxX - bounds.minX) * mapSize;
    const ny = (z - bounds.minZ) / (bounds.maxZ - bounds.minZ) * mapSize;
    return { x: nx, y: ny };
  };

  // Build track path SVG
  const trackPathD = useMemo(() => {
    const pts = trackPoints.map(p => worldToMap(p.x, p.z));
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
  }, [trackPoints, bounds]);

  const carColors: Record<string, string> = {
    'player': '#00ff88',
    'ai-0': '#ff3333',
    'ai-1': '#ffcc00',
    'ai-2': '#00aaff',
    'ai-3': '#ff6600',
  };

  return (
    <div className="absolute top-32 right-8 bg-card/80 backdrop-blur-sm rounded-lg p-3 border border-border">
      <div className="text-muted-foreground text-xs mb-1">미니맵</div>
      <svg width={mapSize} height={mapSize} viewBox={`0 0 ${mapSize} ${mapSize}`}>
        {/* Track path */}
        <path 
          d={trackPathD} 
          fill="none" 
          stroke="#222" 
          strokeWidth="8" 
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path 
          d={trackPathD} 
          fill="none" 
          stroke="#555" 
          strokeWidth="5" 
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* Cars */}
        {Array.from(carPositions.entries()).map(([id, pos]) => {
          const mapPos = worldToMap(pos.x, pos.z);
          const isPlayer = id === 'player';
          return (
            <g key={id}>
              {isPlayer && (
                <circle 
                  cx={mapPos.x} 
                  cy={mapPos.y} 
                  r={6} 
                  fill={carColors[id] || '#fff'}
                  opacity={0.3}
                />
              )}
              <circle 
                cx={mapPos.x} 
                cy={mapPos.y} 
                r={isPlayer ? 4 : 3} 
                fill={carColors[id] || '#fff'}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
};
