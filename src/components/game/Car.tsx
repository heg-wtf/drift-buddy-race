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
  onPositionUpdate?: (id: string, position: THREE.Vector3) => void;
  trackRadius?: number;
  aiIndex?: number;
  id: string;
  otherCars?: Map<string, THREE.Vector3>;
  damage?: number;
  onDamage?: (id: string, amount: number) => void;
}

export const Car = ({ 
  position, 
  color, 
  isPlayer = false, 
  controls,
  onUpdate,
  onPositionUpdate,
  trackRadius = 25,
  aiIndex = 0,
  id,
  otherCars,
  damage = 0,
  onDamage
}: CarProps) => {
  const carRef = useRef<THREE.Group>(null);
  const velocity = useRef(0);
  const rotation = useRef(0);
  const aiAngle = useRef(Math.random() * Math.PI * 2);
  const aiSpeed = useRef(0.3 + Math.random() * 0.15);
  const knockbackVelocity = useRef(new THREE.Vector3(0, 0, 0));
  const sparksRef = useRef<THREE.Points>(null);
  const sparkTime = useRef(0);

  useEffect(() => {
    if (carRef.current) {
      carRef.current.position.set(...position);
      if (!isPlayer) {
        aiAngle.current = Math.atan2(position[0], position[2]);
      }
    }
  }, []);

  useFrame((_, delta) => {
    if (!carRef.current) return;

    // Apply knockback
    if (knockbackVelocity.current.length() > 0.01) {
      carRef.current.position.add(knockbackVelocity.current.clone().multiplyScalar(delta * 60));
      knockbackVelocity.current.multiplyScalar(0.9);
    }

    // Check collision with other cars
    if (otherCars) {
      otherCars.forEach((otherPos, otherId) => {
        if (otherId === id) return;
        
        const distance = carRef.current!.position.distanceTo(otherPos);
        if (distance < 2.5) {
          // Collision detected!
          const pushDir = carRef.current!.position.clone().sub(otherPos).normalize();
          knockbackVelocity.current.add(pushDir.multiplyScalar(0.3));
          
          // Apply damage based on speed
          if (onDamage && Math.abs(velocity.current) > 0.1) {
            onDamage(id, Math.abs(velocity.current) * 10);
          }
          
          // Reduce speed on collision
          velocity.current *= 0.3;
          
          // Trigger sparks
          sparkTime.current = 0.5;
        }
      });
    }

    // Update sparks
    if (sparksRef.current && sparkTime.current > 0) {
      sparkTime.current -= delta;
      sparksRef.current.visible = true;
      sparksRef.current.rotation.x += delta * 10;
      sparksRef.current.rotation.y += delta * 15;
    } else if (sparksRef.current) {
      sparksRef.current.visible = false;
    }

    if (damage >= 100) {
      // Car is destroyed - don't move
      return;
    }

    if (isPlayer && controls) {
      // Player controls with damage affecting performance
      const damageMultiplier = Math.max(0.3, 1 - damage / 150);
      const acceleration = 0.5 * damageMultiplier;
      const friction = 0.98;
      const turnSpeed = 2.5 * damageMultiplier;
      const maxSpeed = 0.8 * damageMultiplier;

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
      
      carRef.current.position.x = targetX + knockbackVelocity.current.x;
      carRef.current.position.z = targetZ + knockbackVelocity.current.z;
      carRef.current.rotation.y = aiAngle.current + Math.PI;
    }

    // Report position for collision detection
    if (onPositionUpdate) {
      onPositionUpdate(id, carRef.current.position.clone());
    }
  });

  const isDestroyed = damage >= 100;
  const damageLevel = Math.min(damage / 100, 1);

  // Generate spark particles geometry
  const sparkPositions = new Float32Array(30 * 3);
  for (let i = 0; i < 30; i++) {
    sparkPositions[i * 3] = (Math.random() - 0.5) * 3;
    sparkPositions[i * 3 + 1] = Math.random() * 2;
    sparkPositions[i * 3 + 2] = (Math.random() - 0.5) * 3;
  }

  return (
    <group ref={carRef}>
      {/* Sparks on collision */}
      <points ref={sparksRef} visible={false}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={30}
            array={sparkPositions}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial color="#ffaa00" size={0.15} transparent opacity={0.8} />
      </points>

      {!isDestroyed ? (
        <>
          {/* Car body - deforms with damage */}
          <mesh 
            position={[0, 0.4, 0]} 
            castShadow
            scale={[1 - damageLevel * 0.1, 1 - damageLevel * 0.2, 1 - damageLevel * 0.05]}
            rotation={[damageLevel * 0.1, 0, damageLevel * 0.15]}
          >
            <boxGeometry args={[1.2, 0.5, 2.5]} />
            <meshStandardMaterial 
              color={color} 
              metalness={0.8 - damageLevel * 0.3} 
              roughness={0.2 + damageLevel * 0.5} 
            />
          </mesh>
          
          {/* Cabin */}
          <mesh 
            position={[damageLevel * 0.1, 0.75 - damageLevel * 0.1, -0.2]} 
            castShadow
            rotation={[0, 0, damageLevel * 0.2]}
          >
            <boxGeometry args={[1, 0.4, 1.2]} />
            <meshStandardMaterial color="#1a1a2e" metalness={0.9} roughness={0.1} />
          </mesh>
          
          {/* Wheels - some may be missing with damage */}
          {[[-0.6, 0.2, 0.8], [0.6, 0.2, 0.8], [-0.6, 0.2, -0.8], [0.6, 0.2, -0.8]].map((pos, i) => (
            damageLevel < 0.3 + i * 0.2 && (
              <mesh 
                key={i} 
                position={pos as [number, number, number]} 
                rotation={[0, 0, Math.PI / 2]} 
                castShadow
              >
                <cylinderGeometry args={[0.25, 0.25, 0.2, 16]} />
                <meshStandardMaterial color="#222" metalness={0.3} roughness={0.8} />
              </mesh>
            )
          ))}
          
          {/* Headlights */}
          {isPlayer && damageLevel < 0.5 && (
            <>
              <pointLight position={[0.4, 0.4, 1.3]} intensity={2} distance={15} color="#fff" />
              <pointLight position={[-0.4, 0.4, 1.3]} intensity={2} distance={15} color="#fff" />
            </>
          )}
          
          {/* Tail lights */}
          {damageLevel < 0.7 && (
            <>
              <mesh position={[0.4, 0.4, -1.25]}>
                <boxGeometry args={[0.2, 0.1, 0.05]} />
                <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={0.5} />
              </mesh>
              <mesh position={[-0.4, 0.4, -1.25]}>
                <boxGeometry args={[0.2, 0.1, 0.05]} />
                <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={0.5} />
              </mesh>
            </>
          )}

          {/* Damage smoke */}
          {damageLevel > 0.3 && (
            <mesh position={[0, 1, 0.5]}>
              <sphereGeometry args={[0.3 + damageLevel * 0.3, 8, 8]} />
              <meshStandardMaterial color="#333" transparent opacity={0.4 * damageLevel} />
            </mesh>
          )}

          {/* Fire when heavily damaged */}
          {damageLevel > 0.7 && (
            <pointLight position={[0, 0.8, 0.3]} intensity={3} distance={5} color="#ff4400" />
          )}
        </>
      ) : (
        /* Destroyed car - wreckage */
        <>
          <mesh position={[0, 0.2, 0]} rotation={[0.3, 0.2, 0.5]}>
            <boxGeometry args={[1.4, 0.3, 2]} />
            <meshStandardMaterial color="#111" metalness={0.2} roughness={0.9} />
          </mesh>
          {/* Debris pieces */}
          {[...Array(5)].map((_, i) => (
            <mesh 
              key={i} 
              position={[(Math.random() - 0.5) * 3, 0.1, (Math.random() - 0.5) * 3]}
              rotation={[Math.random(), Math.random(), Math.random()]}
            >
              <boxGeometry args={[0.3, 0.2, 0.4]} />
              <meshStandardMaterial color={color} metalness={0.5} roughness={0.7} />
            </mesh>
          ))}
          {/* Fire */}
          <pointLight position={[0, 0.5, 0]} intensity={5} distance={8} color="#ff2200" />
          <mesh position={[0, 0.5, 0]}>
            <sphereGeometry args={[0.5, 8, 8]} />
            <meshStandardMaterial color="#ff4400" emissive="#ff2200" emissiveIntensity={2} transparent opacity={0.7} />
          </mesh>
        </>
      )}
    </group>
  );
};
