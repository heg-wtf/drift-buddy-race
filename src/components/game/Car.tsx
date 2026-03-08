import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getTrackPath, getTrackBounds } from './Track';

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
  aiIndex?: number;
  id: string;
  otherCars?: Map<string, THREE.Vector3>;
  damage?: number;
  onDamage?: (id: string, amount: number) => void;
  trackWidth?: number;
}

export const Car = ({ 
  position, 
  color, 
  isPlayer = false, 
  controls,
  onUpdate,
  onPositionUpdate,
  aiIndex = 0,
  id,
  otherCars,
  damage = 0,
  onDamage,
  trackWidth = 10
}: CarProps) => {
  const carRef = useRef<THREE.Group>(null);
  const velocity = useRef(0);
  const rotation = useRef(0);
  const aiProgress = useRef(aiIndex * 0.1);
  const aiSpeed = useRef(0.008 + Math.random() * 0.003);
  const knockbackVelocity = useRef(new THREE.Vector3(0, 0, 0));
  const sparksRef = useRef<THREE.Points>(null);
  const sparkTime = useRef(0);
  
  const trackPath = useRef(getTrackPath());
  const trackBounds = useRef(getTrackBounds(trackWidth));

  useEffect(() => {
    if (carRef.current) {
      // Start at beginning of track
      const startPoint = trackPath.current.getPointAt(0);
      const nextPoint = trackPath.current.getPointAt(0.01);
      const startDir = new THREE.Vector3().subVectors(nextPoint, startPoint).normalize();
      rotation.current = Math.atan2(startDir.x, startDir.z);
      
      if (isPlayer) {
        carRef.current.position.set(startPoint.x, 0, startPoint.z);
      } else {
        const aiStart = trackPath.current.getPointAt(aiProgress.current % 1);
        carRef.current.position.set(aiStart.x, 0, aiStart.z);
      }
    }
  }, []);

  const checkWallCollision = (pos: THREE.Vector3): { hit: boolean; normal: THREE.Vector3 } => {
    const { innerPoints, outerPoints, centerPoints } = trackBounds.current;
    
    // Find closest point on track center
    let minDist = Infinity;
    let closestIdx = 0;
    
    for (let i = 0; i < centerPoints.length; i++) {
      const dist = pos.distanceTo(centerPoints[i]);
      if (dist < minDist) {
        minDist = dist;
        closestIdx = i;
      }
    }
    
    // Check distance to inner and outer walls
    const innerDist = pos.distanceTo(innerPoints[closestIdx]);
    const outerDist = pos.distanceTo(outerPoints[closestIdx]);
    
    const wallThreshold = 1.5;
    
    if (innerDist < wallThreshold) {
      const normal = pos.clone().sub(innerPoints[closestIdx]).normalize();
      return { hit: true, normal };
    }
    
    if (outerDist < wallThreshold) {
      const normal = pos.clone().sub(outerPoints[closestIdx]).normalize();
      return { hit: true, normal };
    }
    
    // Check if car is off track
    const toInner = innerPoints[closestIdx].clone().sub(centerPoints[closestIdx]);
    const toOuter = outerPoints[closestIdx].clone().sub(centerPoints[closestIdx]);
    const toCar = pos.clone().sub(centerPoints[closestIdx]);
    
    const innerDir = toInner.normalize();
    const carDir = toCar.clone().normalize();
    
    const distFromCenter = toCar.length();
    const halfWidth = trackWidth / 2;
    
    if (distFromCenter > halfWidth - 0.5) {
      return { hit: true, normal: carDir.negate() };
    }
    
    return { hit: false, normal: new THREE.Vector3() };
  };

  useFrame((_, delta) => {
    if (!carRef.current) return;

    // Apply knockback
    if (knockbackVelocity.current.length() > 0.01) {
      carRef.current.position.add(knockbackVelocity.current.clone().multiplyScalar(delta * 60));
      knockbackVelocity.current.multiplyScalar(0.85);
    }

    // Check collision with other cars
    if (otherCars) {
      otherCars.forEach((otherPos, otherId) => {
        if (otherId === id) return;
        
        const distance = carRef.current!.position.distanceTo(otherPos);
        if (distance < 2.5) {
          const pushDir = carRef.current!.position.clone().sub(otherPos).normalize();
          knockbackVelocity.current.add(pushDir.multiplyScalar(0.25));
          
          if (onDamage && Math.abs(velocity.current) > 0.05) {
            onDamage(id, Math.abs(velocity.current) * 15);
          }
          
          velocity.current *= 0.4;
          sparkTime.current = 0.5;
        }
      });
    }

    // Check wall collision
    const wallCheck = checkWallCollision(carRef.current.position);
    if (wallCheck.hit) {
      knockbackVelocity.current.add(wallCheck.normal.multiplyScalar(0.2));
      
      if (onDamage && Math.abs(velocity.current) > 0.05) {
        onDamage(id, Math.abs(velocity.current) * 20);
      }
      
      velocity.current *= 0.3;
      sparkTime.current = 0.3;
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

    if (damage >= 100) return;

    if (isPlayer && controls) {
      const damageMultiplier = Math.max(0.3, 1 - damage / 150);
      const acceleration = 0.6 * damageMultiplier;
      const friction = 0.98;
      const turnSpeed = 2.8 * damageMultiplier;
      const maxSpeed = 0.9 * damageMultiplier;

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

      if (onUpdate) {
        onUpdate(carRef.current.position.clone(), rotation.current, Math.abs(velocity.current) * 250);
      }
    } else {
      // AI car - follows track path
      aiProgress.current += aiSpeed.current * delta * 60;
      if (aiProgress.current > 1) aiProgress.current -= 1;
      
      const currentPoint = trackPath.current.getPointAt(aiProgress.current % 1);
      const nextPoint = trackPath.current.getPointAt((aiProgress.current + 0.01) % 1);
      
      carRef.current.position.x = currentPoint.x + knockbackVelocity.current.x;
      carRef.current.position.z = currentPoint.z + knockbackVelocity.current.z;
      
      const direction = new THREE.Vector3().subVectors(nextPoint, currentPoint).normalize();
      carRef.current.rotation.y = Math.atan2(direction.x, direction.z);
    }

    if (onPositionUpdate) {
      onPositionUpdate(id, carRef.current.position.clone());
    }
  });

  const isDestroyed = damage >= 100;
  const damageLevel = Math.min(damage / 100, 1);

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
          {/* F1 Race Car Body - Main chassis */}
          <mesh 
            position={[0, 0.25, 0]} 
            castShadow
            scale={[1 - damageLevel * 0.1, 1 - damageLevel * 0.15, 1]}
            rotation={[damageLevel * 0.05, 0, damageLevel * 0.1]}
          >
            <boxGeometry args={[0.9, 0.25, 3.2]} />
            <meshStandardMaterial color={color} metalness={0.9} roughness={0.15} />
          </mesh>
          
          {/* Nose cone */}
          <mesh position={[0, 0.2, 1.8]} castShadow>
            <coneGeometry args={[0.3, 0.8, 8]} rotation={[Math.PI / 2, 0, 0]} />
            <meshStandardMaterial color={color} metalness={0.9} roughness={0.15} />
          </mesh>
          
          {/* Cockpit */}
          <mesh position={[0, 0.45, -0.3]} castShadow>
            <boxGeometry args={[0.5, 0.25, 0.8]} />
            <meshStandardMaterial color="#111" metalness={0.95} roughness={0.05} />
          </mesh>
          
          {/* Halo */}
          <mesh position={[0, 0.55, -0.1]}>
            <torusGeometry args={[0.25, 0.03, 8, 16, Math.PI]} />
            <meshStandardMaterial color="#333" metalness={0.8} />
          </mesh>
          
          {/* Front wing */}
          <mesh position={[0, 0.1, 1.9]} castShadow>
            <boxGeometry args={[1.6, 0.05, 0.4]} />
            <meshStandardMaterial color={color} metalness={0.8} roughness={0.2} />
          </mesh>
          
          {/* Front wing end plates */}
          {[-0.75, 0.75].map((x, i) => (
            <mesh key={i} position={[x, 0.15, 1.9]} castShadow>
              <boxGeometry args={[0.05, 0.15, 0.5]} />
              <meshStandardMaterial color="#111" />
            </mesh>
          ))}
          
          {/* Rear wing */}
          <mesh position={[0, 0.6, -1.5]} castShadow>
            <boxGeometry args={[1.2, 0.05, 0.3]} />
            <meshStandardMaterial color={color} metalness={0.8} roughness={0.2} />
          </mesh>
          
          {/* Rear wing supports */}
          {[-0.4, 0.4].map((x, i) => (
            <mesh key={i} position={[x, 0.45, -1.5]} castShadow>
              <boxGeometry args={[0.04, 0.25, 0.04]} />
              <meshStandardMaterial color="#111" />
            </mesh>
          ))}
          
          {/* Side pods */}
          {[-0.55, 0.55].map((x, i) => (
            <mesh key={i} position={[x, 0.3, 0]} castShadow>
              <boxGeometry args={[0.35, 0.2, 1.5]} />
              <meshStandardMaterial color={color} metalness={0.85} roughness={0.2} />
            </mesh>
          ))}
          
          {/* Wheels - F1 style */}
          {[
            [-0.65, 0.2, 1.1], [0.65, 0.2, 1.1],  // Front
            [-0.65, 0.25, -1.0], [0.65, 0.25, -1.0]  // Rear
          ].map((pos, i) => (
            damageLevel < 0.4 + i * 0.15 && (
              <group key={i} position={pos as [number, number, number]}>
                {/* Tire */}
                <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
                  <cylinderGeometry args={[i < 2 ? 0.22 : 0.28, i < 2 ? 0.22 : 0.28, 0.18, 16]} />
                  <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
                </mesh>
                {/* Rim */}
                <mesh rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.12, 0.12, 0.19, 8]} />
                  <meshStandardMaterial color="#c0c0c0" metalness={0.9} roughness={0.1} />
                </mesh>
              </group>
            )
          ))}

          {/* Damage smoke */}
          {damageLevel > 0.3 && (
            <mesh position={[0, 0.8, -0.5]}>
              <sphereGeometry args={[0.25 + damageLevel * 0.25, 8, 8]} />
              <meshStandardMaterial color="#444" transparent opacity={0.5 * damageLevel} />
            </mesh>
          )}

          {/* Fire when heavily damaged */}
          {damageLevel > 0.7 && (
            <pointLight position={[0, 0.5, -1]} intensity={4} distance={5} color="#ff4400" />
          )}
        </>
      ) : (
        /* Destroyed car wreckage */
        <>
          <mesh position={[0, 0.15, 0]} rotation={[0.2, 0.3, 0.4]}>
            <boxGeometry args={[1, 0.2, 2.5]} />
            <meshStandardMaterial color="#111" metalness={0.3} roughness={0.9} />
          </mesh>
          {[...Array(6)].map((_, i) => (
            <mesh 
              key={i} 
              position={[(Math.random() - 0.5) * 4, 0.1, (Math.random() - 0.5) * 4]}
              rotation={[Math.random() * 2, Math.random() * 2, Math.random() * 2]}
            >
              <boxGeometry args={[0.3 + Math.random() * 0.2, 0.15, 0.4 + Math.random() * 0.2]} />
              <meshStandardMaterial color={color} metalness={0.5} roughness={0.7} />
            </mesh>
          ))}
          <pointLight position={[0, 0.5, 0]} intensity={6} distance={8} color="#ff2200" />
        </>
      )}
    </group>
  );
};
