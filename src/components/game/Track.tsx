import * as THREE from 'three';
import { useMemo } from 'react';

interface TrackProps {
  radius?: number;
  width?: number;
}

export const Track = ({ radius = 25, width = 12 }: TrackProps) => {
  const trackShape = useMemo(() => {
    const shape = new THREE.Shape();
    const outerRadius = radius + width / 2;
    const innerRadius = radius - width / 2;
    
    // Outer circle
    shape.absarc(0, 0, outerRadius, 0, Math.PI * 2, false);
    
    // Inner circle (hole)
    const hole = new THREE.Path();
    hole.absarc(0, 0, innerRadius, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    
    return shape;
  }, [radius, width]);

  return (
    <group>
      {/* Track surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <shapeGeometry args={[trackShape]} />
        <meshStandardMaterial color="#333" roughness={0.9} />
      </mesh>
      
      {/* Track lines */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[radius - 0.1, radius + 0.1, 64]} />
        <meshStandardMaterial color="#fff" opacity={0.3} transparent />
      </mesh>
      
      {/* Outer barrier */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.3, 0]}>
        <ringGeometry args={[radius + width / 2, radius + width / 2 + 0.5, 64]} />
        <meshStandardMaterial color="#ff3366" emissive="#ff3366" emissiveIntensity={0.3} />
      </mesh>
      
      {/* Inner barrier */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.3, 0]}>
        <ringGeometry args={[radius - width / 2 - 0.5, radius - width / 2, 64]} />
        <meshStandardMaterial color="#00ffcc" emissive="#00ffcc" emissiveIntensity={0.3} />
      </mesh>
      
      {/* Start/Finish line */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[radius, 0.03, 0]}>
        <planeGeometry args={[width, 2]} />
        <meshStandardMaterial color="#fff" />
      </mesh>
      
      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
        <circleGeometry args={[100, 64]} />
        <meshStandardMaterial color="#1a1a2e" />
      </mesh>
    </group>
  );
};
