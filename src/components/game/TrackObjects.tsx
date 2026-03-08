import * as THREE from 'three';
import { useMemo } from 'react';

// Cameramen positioned outside corners of the track
export const Cameramen = () => {
  const mesh = useMemo(() => {
    // Positions outside each turn apex, offset outward from track
    const positions: [number, number, number, number][] = [
      // [x, z, rotation, which turn]
      // T1 — outside right
      [75, 75, -0.5, 1],
      // T2 — outside of hairpin
      [420, 100, Math.PI / 2, 2],
      [398, 130, 0.8, 2],
      // T3
      [85, 132, 0.3, 3],
      // T4
      [5, 100, 1.2, 4],
      // T5
      [-50, 30, 1.8, 5],
      // T6-T7
      [-95, -25, 2.0, 6],
      [-100, -55, 2.2, 7],
      // T8 — multi-apex
      [-130, -110, 2.5, 8],
      [-125, -148, 3.0, 8],
      // T9
      [-55, -182, -0.5, 9],
      // T11
      [55, -145, -0.3, 11],
      // T12
      [98, -115, -1.0, 12],
      // T13
      [72, -55, -1.5, 13],
    ];

    const count = positions.length;
    
    // Body (torso)
    const bodyGeo = new THREE.CylinderGeometry(0.3, 0.25, 1.4, 6);
    const bodyMat = new THREE.MeshStandardMaterial({ color: '#1a1a2e', roughness: 0.8 });
    const bodyMesh = new THREE.InstancedMesh(bodyGeo, bodyMat, count);

    // Head
    const headGeo = new THREE.SphereGeometry(0.22, 6, 6);
    const headMat = new THREE.MeshStandardMaterial({ color: '#deb887', roughness: 0.7 });
    const headMesh = new THREE.InstancedMesh(headGeo, headMat, count);

    // Camera (box on shoulder)
    const camGeo = new THREE.BoxGeometry(0.5, 0.35, 0.7);
    const camMat = new THREE.MeshStandardMaterial({ color: '#222222', metalness: 0.6, roughness: 0.3 });
    const camMesh = new THREE.InstancedMesh(camGeo, camMat, count);

    // Tripod legs
    const tripodGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.2, 4);
    const tripodMat = new THREE.MeshStandardMaterial({ color: '#333333', metalness: 0.4 });
    const tripodMesh = new THREE.InstancedMesh(tripodGeo, tripodMat, count * 3);

    const dummy = new THREE.Object3D();

    for (let i = 0; i < count; i++) {
      const [x, z, rot] = positions[i];
      
      // Body
      dummy.position.set(x, 0.7, z);
      dummy.rotation.set(0, rot, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      bodyMesh.setMatrixAt(i, dummy.matrix);

      // Head
      dummy.position.set(x, 1.6, z);
      dummy.updateMatrix();
      headMesh.setMatrixAt(i, dummy.matrix);

      // Camera
      const camOffX = x + Math.sin(rot) * 0.6;
      const camOffZ = z + Math.cos(rot) * 0.6;
      dummy.position.set(camOffX, 1.3, camOffZ);
      dummy.rotation.set(0, rot, 0);
      dummy.updateMatrix();
      camMesh.setMatrixAt(i, dummy.matrix);

      // Tripod (3 legs)
      for (let t = 0; t < 3; t++) {
        const angle = rot + (t - 1) * 0.5;
        const legX = camOffX + Math.sin(angle) * 0.15;
        const legZ = camOffZ + Math.cos(angle) * 0.15;
        dummy.position.set(legX, 0.6, legZ);
        dummy.rotation.set(0, 0, (t - 1) * 0.15);
        dummy.updateMatrix();
        tripodMesh.setMatrixAt(i * 3 + t, dummy.matrix);
      }
    }

    bodyMesh.instanceMatrix.needsUpdate = true;
    headMesh.instanceMatrix.needsUpdate = true;
    camMesh.instanceMatrix.needsUpdate = true;
    tripodMesh.instanceMatrix.needsUpdate = true;

    return { bodyMesh, headMesh, camMesh, tripodMesh };
  }, []);

  return (
    <group>
      <primitive object={mesh.bodyMesh} />
      <primitive object={mesh.headMesh} />
      <primitive object={mesh.camMesh} />
      <primitive object={mesh.tripodMesh} />
    </group>
  );
};

// Random buildings scattered around the track
export const TrackBuildings = () => {
  const buildings = useMemo(() => {
    // Building positions away from track, with size and color
    const defs: { pos: [number, number, number]; size: [number, number, number]; color: string }[] = [
      // Near start area
      { pos: [85, 0, -40], size: [8, 12, 10], color: '#6b7280' },
      { pos: [95, 0, -10], size: [6, 8, 8], color: '#78716c' },
      
      // Far right side near T2
      { pos: [430, 0, 60], size: [12, 15, 10], color: '#64748b' },
      { pos: [435, 0, 130], size: [8, 10, 12], color: '#7c8590' },
      
      // Bottom straight area
      { pos: [180, 0, 155], size: [10, 7, 14], color: '#6d7580' },
      { pos: [260, 0, 158], size: [14, 9, 8], color: '#8b8e94' },
      
      // Left side near T4-T5
      { pos: [-40, 0, 105], size: [7, 11, 9], color: '#71717a' },
      { pos: [-75, 0, 55], size: [9, 6, 7], color: '#6b7280' },
      
      // Top left near T8
      { pos: [-145, 0, -130], size: [10, 14, 10], color: '#64748b' },
      { pos: [-140, 0, -170], size: [8, 8, 12], color: '#78716c' },
      
      // Top right near T10-T12
      { pos: [30, 0, -180], size: [12, 10, 8], color: '#7c8590' },
      { pos: [100, 0, -155], size: [6, 16, 6], color: '#6d7580' },
      
      // Control tower near start
      { pos: [90, 0, 15], size: [5, 18, 5], color: '#475569' },
    ];

    return defs;
  }, []);

  return (
    <group>
      {buildings.map((b, i) => (
        <group key={i}>
          {/* Main building */}
          <mesh position={[b.pos[0], b.size[1] / 2, b.pos[2]]} castShadow receiveShadow>
            <boxGeometry args={b.size} />
            <meshStandardMaterial color={b.color} roughness={0.85} />
          </mesh>
          {/* Roof accent */}
          <mesh position={[b.pos[0], b.size[1] + 0.1, b.pos[2]]}>
            <boxGeometry args={[b.size[0] + 0.4, 0.2, b.size[2] + 0.4]} />
            <meshStandardMaterial color="#374151" roughness={0.7} />
          </mesh>
          {/* Windows (front face) */}
          {Array.from({ length: Math.floor(b.size[1] / 3) }).map((_, wi) => (
            <mesh key={wi} position={[b.pos[0] - b.size[0] / 2 - 0.01, 2 + wi * 3, b.pos[2]]}>
              <planeGeometry args={[b.size[0] * 0.6, 1.5]} />
              <meshStandardMaterial color="#93c5fd" emissive="#60a5fa" emissiveIntensity={0.15} metalness={0.8} roughness={0.2} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
};
