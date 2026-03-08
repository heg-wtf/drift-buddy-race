import * as THREE from 'three';
import { useMemo } from 'react';

// Silverstone-inspired track points (simplified approximation)
const SILVERSTONE_POINTS = [
  // Start/Finish straight
  { x: 0, z: 0 },
  { x: 15, z: 0 },
  // Copse corner
  { x: 25, z: 5 },
  { x: 30, z: 15 },
  // Maggots & Becketts
  { x: 28, z: 25 },
  { x: 22, z: 32 },
  { x: 15, z: 35 },
  { x: 8, z: 38 },
  // Chapel
  { x: 0, z: 42 },
  { x: -10, z: 45 },
  // Hangar Straight
  { x: -25, z: 45 },
  { x: -35, z: 42 },
  // Stowe
  { x: -42, z: 35 },
  { x: -45, z: 25 },
  // Vale & Club
  { x: -42, z: 15 },
  { x: -38, z: 8 },
  { x: -30, z: 5 },
  // Abbey
  { x: -20, z: 2 },
  { x: -10, z: -2 },
  // Back to start
  { x: -5, z: -2 },
];

export const getTrackPath = () => {
  const curve = new THREE.CatmullRomCurve3(
    SILVERSTONE_POINTS.map(p => new THREE.Vector3(p.x, 0, p.z)),
    true,
    'catmullrom',
    0.5
  );
  return curve;
};

export const getTrackBounds = (trackWidth: number = 10) => {
  const curve = getTrackPath();
  const points = curve.getPoints(200);
  
  const innerPoints: THREE.Vector3[] = [];
  const outerPoints: THREE.Vector3[] = [];
  
  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    
    const direction = new THREE.Vector3().subVectors(next, current).normalize();
    const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x);
    
    innerPoints.push(current.clone().add(perpendicular.clone().multiplyScalar(-trackWidth / 2)));
    outerPoints.push(current.clone().add(perpendicular.clone().multiplyScalar(trackWidth / 2)));
  }
  
  return { innerPoints, outerPoints, centerPoints: points };
};

interface TrackProps {
  width?: number;
}

export const Track = ({ width = 10 }: TrackProps) => {
  const { trackShape, innerShape, outerShape, startLinePos, startLineRot } = useMemo(() => {
    const curve = getTrackPath();
    const points = curve.getPoints(200);
    
    const innerPoints: THREE.Vector2[] = [];
    const outerPoints: THREE.Vector2[] = [];
    
    for (let i = 0; i < points.length; i++) {
      const current = points[i];
      const next = points[(i + 1) % points.length];
      
      const direction = new THREE.Vector3().subVectors(next, current).normalize();
      const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x);
      
      const inner = current.clone().add(perpendicular.clone().multiplyScalar(-width / 2));
      const outer = current.clone().add(perpendicular.clone().multiplyScalar(width / 2));
      
      innerPoints.push(new THREE.Vector2(inner.x, inner.z));
      outerPoints.push(new THREE.Vector2(outer.x, outer.z));
    }
    
    // Create track shape
    const shape = new THREE.Shape();
    shape.moveTo(outerPoints[0].x, outerPoints[0].y);
    outerPoints.forEach(p => shape.lineTo(p.x, p.y));
    shape.lineTo(outerPoints[0].x, outerPoints[0].y);
    
    const hole = new THREE.Path();
    hole.moveTo(innerPoints[0].x, innerPoints[0].y);
    innerPoints.forEach(p => hole.lineTo(p.x, p.y));
    hole.lineTo(innerPoints[0].x, innerPoints[0].y);
    shape.holes.push(hole);
    
    // Inner barrier shape
    const innerBarrier = new THREE.Shape();
    innerBarrier.moveTo(innerPoints[0].x, innerPoints[0].y);
    innerPoints.forEach(p => innerBarrier.lineTo(p.x, p.y));
    
    // Outer barrier shape  
    const outerBarrier = new THREE.Shape();
    outerBarrier.moveTo(outerPoints[0].x, outerPoints[0].y);
    outerPoints.forEach(p => outerBarrier.lineTo(p.x, p.y));
    
    // Start line position and rotation
    const startPos = points[0].clone();
    const nextPos = points[1];
    const startDir = new THREE.Vector3().subVectors(nextPos, startPos).normalize();
    const rotation = Math.atan2(startDir.x, startDir.z);
    
    return { 
      trackShape: shape, 
      innerShape: innerBarrier, 
      outerShape: outerBarrier,
      startLinePos: startPos,
      startLineRot: rotation
    };
  }, [width]);

  return (
    <group>
      {/* Track surface - black asphalt */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <shapeGeometry args={[trackShape]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.85} />
      </mesh>
      
      {/* Track overlay for depth */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <shapeGeometry args={[trackShape]} />
        <meshStandardMaterial color="#111111" roughness={0.9} />
      </mesh>
      
      {/* Center racing line */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
        <tubeGeometry args={[getTrackPath(), 200, 0.15, 8, true]} />
        <meshStandardMaterial color="#fff" opacity={0.3} transparent />
      </mesh>
      
      {/* Inner barrier */}
      <mesh position={[0, 0.4, 0]}>
        <tubeGeometry args={[
          new THREE.CatmullRomCurve3(
            getTrackBounds(width).innerPoints,
            true
          ), 200, 0.3, 8, true
        ]} />
        <meshStandardMaterial color="#e74c3c" />
      </mesh>
      
      {/* Outer barrier */}
      <mesh position={[0, 0.4, 0]}>
        <tubeGeometry args={[
          new THREE.CatmullRomCurve3(
            getTrackBounds(width).outerPoints,
            true
          ), 200, 0.3, 8, true
        ]} />
        <meshStandardMaterial color="#3498db" />
      </mesh>
      
      {/* Start/Finish line */}
      <mesh 
        position={[startLinePos.x, 0.03, startLinePos.z]} 
        rotation={[-Math.PI / 2, 0, startLineRot]}
      >
        <planeGeometry args={[width, 3]} />
        <meshStandardMaterial color="#fff" />
      </mesh>
      
      {/* Checkered pattern on start line */}
      {[...Array(5)].map((_, i) => (
        <mesh 
          key={i}
          position={[
            startLinePos.x + Math.sin(startLineRot + Math.PI/2) * (i - 2) * 2,
            0.035,
            startLinePos.z + Math.cos(startLineRot + Math.PI/2) * (i - 2) * 2
          ]} 
          rotation={[-Math.PI / 2, 0, startLineRot]}
        >
          <planeGeometry args={[2, 1.5]} />
          <meshStandardMaterial color={i % 2 === 0 ? '#000' : '#fff'} />
        </mesh>
      ))}
      
      {/* Grass/ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#2d5a27" />
      </mesh>
      
      {/* Inner grass area */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <shapeGeometry args={[new THREE.Shape(
          getTrackBounds(width).innerPoints.map(p => new THREE.Vector2(p.x, p.z))
        )]} />
        <meshStandardMaterial color="#3d7a37" />
      </mesh>
    </group>
  );
};
