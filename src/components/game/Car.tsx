import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface CarProps {
  position: [number, number, number];
  color: string;
  isPlayer?: boolean;
  controls?: {
    forward: boolean;
    backward: boolean;
    left: boolean;
    right: boolean;
  };
  onUpdate?: (position: THREE.Vector3, rotation: number, speed: number) => void;
  trackRadius?: number;
  aiIndex?: number;
}

export const Car = ({ 
  position, 
  color, 
  isPlayer = false, 
  controls,
  onUpdate,
  trackRadius = 25,
  aiIndex = 0
}: CarProps) => {
  const carRef = useRef<THREE.Group>(null);
  const velocity = useRef(0);
  const rotation = useRef(0);
  const aiAngle = useRef(Math.random() * Math.PI * 2);
  const aiSpeed = useRef(0.3 + Math.random() * 0.15);

  useEffect(() => {
    if (carRef.current) {
      carRef.current.position.set(...position);
    }
  }, []);

  useFrame((_, delta) => {
    if (!carRef.current) return;

    if (isPlayer && controls) {
      // Player controls
      const acceleration = 0.5;
      const friction = 0.98;
      const turnSpeed = 2.5;
      const maxSpeed = 0.8;

      if (controls.forward) {
        velocity.current = Math.min(velocity.current + acceleration * delta, maxSpeed);
      }
      if (controls.backward) {
        velocity.current = Math.max(velocity.current - acceleration * delta, -maxSpeed * 0.5);
      }

      velocity.current *= friction;

      if (Math.abs(velocity.current) > 0.01) {
        if (controls.left) {
          rotation.current += turnSpeed * delta * Math.sign(velocity.current);
        }
        if (controls.right) {
          rotation.current -= turnSpeed * delta * Math.sign(velocity.current);
        }
      }

      carRef.current.rotation.y = rotation.current;
      carRef.current.position.x += Math.sin(rotation.current) * velocity.current;
      carRef.current.position.z += Math.cos(rotation.current) * velocity.current;

      // Keep car on track (simple bounds)
      const distFromCenter = Math.sqrt(
        carRef.current.position.x ** 2 + carRef.current.position.z ** 2
      );
      if (distFromCenter > trackRadius + 8) {
        const angle = Math.atan2(carRef.current.position.x, carRef.current.position.z);
        carRef.current.position.x = Math.sin(angle) * (trackRadius + 8);
        carRef.current.position.z = Math.cos(angle) * (trackRadius + 8);
        velocity.current *= 0.5;
      }
      if (distFromCenter < trackRadius - 8) {
        const angle = Math.atan2(carRef.current.position.x, carRef.current.position.z);
        carRef.current.position.x = Math.sin(angle) * (trackRadius - 8);
        carRef.current.position.z = Math.cos(angle) * (trackRadius - 8);
        velocity.current *= 0.5;
      }

      if (onUpdate) {
        onUpdate(carRef.current.position.clone(), rotation.current, Math.abs(velocity.current) * 200);
      }
    } else {
      // AI car - follows track
      aiAngle.current += aiSpeed.current * delta;
      
      const targetX = Math.sin(aiAngle.current) * trackRadius;
      const targetZ = Math.cos(aiAngle.current) * trackRadius;
      
      carRef.current.position.x = targetX;
      carRef.current.position.z = targetZ;
      carRef.current.rotation.y = aiAngle.current + Math.PI;
    }
  });

  return (
    <group ref={carRef}>
      {/* Car body */}
      <mesh position={[0, 0.4, 0]} castShadow>
        <boxGeometry args={[1.2, 0.5, 2.5]} />
        <meshStandardMaterial color={color} metalness={0.8} roughness={0.2} />
      </mesh>
      
      {/* Cabin */}
      <mesh position={[0, 0.75, -0.2]} castShadow>
        <boxGeometry args={[1, 0.4, 1.2]} />
        <meshStandardMaterial color="#1a1a2e" metalness={0.9} roughness={0.1} />
      </mesh>
      
      {/* Wheels */}
      {[[-0.6, 0.2, 0.8], [0.6, 0.2, 0.8], [-0.6, 0.2, -0.8], [0.6, 0.2, -0.8]].map((pos, i) => (
        <mesh key={i} position={pos as [number, number, number]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.25, 0.25, 0.2, 16]} />
          <meshStandardMaterial color="#222" metalness={0.3} roughness={0.8} />
        </mesh>
      ))}
      
      {/* Headlights */}
      {isPlayer && (
        <>
          <pointLight position={[0.4, 0.4, 1.3]} intensity={2} distance={15} color="#fff" />
          <pointLight position={[-0.4, 0.4, 1.3]} intensity={2} distance={15} color="#fff" />
        </>
      )}
      
      {/* Tail lights */}
      <mesh position={[0.4, 0.4, -1.25]}>
        <boxGeometry args={[0.2, 0.1, 0.05]} />
        <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[-0.4, 0.4, -1.25]}>
        <boxGeometry args={[0.2, 0.1, 0.05]} />
        <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
};
