import * as THREE from 'three';
import { useMemo } from 'react';

// Cameramen positioned outside corners of the track
export const Cameramen = () => {
  const mesh = useMemo(() => {
    // Positions well outside track (15+ units beyond barrier)
    const positions: [number, number, number, number][] = [
      // T1 — outside right (track at ~[58,65], push further out)
      [85, 78, -0.5, 1],
      // T2 — outside of hairpin (track apex at ~[408,100])
      [432, 100, Math.PI / 2, 2],
      [415, 140, 0.8, 2],
      // T3 (track at ~[100,118])
      [85, 145, 0.3, 3],
      // T4 (track at ~[20,92])
      [-5, 115, 1.2, 4],
      // T5 (track at ~[-40,44])
      [-65, 45, 1.8, 5],
      // T6-T7 (track at ~[-80,-40])
      [-110, -25, 2.0, 6],
      [-115, -55, 2.2, 7],
      // T8 — multi-apex (track at ~[-118,-120])
      [-145, -110, 2.5, 8],
      [-140, -155, 3.0, 8],
      // T9 (track at ~[-62,-170])
      [-60, -195, -0.5, 9],
      // T11 (track at ~[42,-134])
      [55, -160, -0.3, 11],
      // T12 (track at ~[86,-110])
      [112, -115, -1.0, 12],
      // T13 (track at ~[62,-68])
      [88, -60, -1.5, 13],
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

// Detailed buildings scattered around the track
export const TrackBuildings = () => {
  const buildings = useMemo(() => {
    const defs: { pos: [number, number]; w: number; h: number; d: number; color: string; roofType: 'flat' | 'pointed' | 'antenna'; floors: number }[] = [
      // Near start area
      { pos: [85, -40], w: 8, h: 12, d: 10, color: '#6b7280', roofType: 'antenna', floors: 4 },
      { pos: [95, -10], w: 6, h: 8, d: 8, color: '#78716c', roofType: 'pointed', floors: 2 },
      
      // Far right near T2
      { pos: [430, 60], w: 12, h: 15, d: 10, color: '#64748b', roofType: 'flat', floors: 5 },
      { pos: [435, 130], w: 8, h: 10, d: 12, color: '#7c8590', roofType: 'pointed', floors: 3 },
      
      // Bottom straight
      { pos: [180, 155], w: 10, h: 7, d: 14, color: '#6d7580', roofType: 'flat', floors: 2 },
      { pos: [260, 158], w: 14, h: 9, d: 8, color: '#8b8e94', roofType: 'flat', floors: 3 },
      
      // Left side T4-T5
      { pos: [-40, 105], w: 7, h: 11, d: 9, color: '#71717a', roofType: 'pointed', floors: 3 },
      { pos: [-75, 55], w: 9, h: 6, d: 7, color: '#6b7280', roofType: 'flat', floors: 2 },
      
      // Top left T8
      { pos: [-145, -130], w: 10, h: 14, d: 10, color: '#64748b', roofType: 'antenna', floors: 4 },
      { pos: [-140, -170], w: 8, h: 8, d: 12, color: '#78716c', roofType: 'flat', floors: 2 },
      
      // Top right T10-T12
      { pos: [30, -180], w: 12, h: 10, d: 8, color: '#7c8590', roofType: 'pointed', floors: 3 },
      { pos: [100, -155], w: 6, h: 16, d: 6, color: '#6d7580', roofType: 'antenna', floors: 5 },
      
      // Control tower near start
      { pos: [90, 15], w: 5, h: 18, d: 5, color: '#475569', roofType: 'antenna', floors: 6 },
    ];
    return defs;
  }, []);

  return (
    <group>
      {buildings.map((b, i) => {
        const x = b.pos[0];
        const z = b.pos[1];
        const floorH = b.h / b.floors;

        return (
          <group key={i}>
            {/* Main structure */}
            <mesh position={[x, b.h / 2, z]} castShadow receiveShadow>
              <boxGeometry args={[b.w, b.h, b.d]} />
              <meshStandardMaterial color={b.color} roughness={0.85} />
            </mesh>

            {/* Floor lines (horizontal bands) */}
            {Array.from({ length: b.floors - 1 }).map((_, fi) => (
              <mesh key={`fl-${fi}`} position={[x - b.w / 2 - 0.02, (fi + 1) * floorH, z]}>
                <planeGeometry args={[0.04, b.d * 0.95]} />
                <meshStandardMaterial color="#555555" />
              </mesh>
            ))}

            {/* Windows - front face */}
            {Array.from({ length: b.floors }).map((_, fi) => {
              const windowsPerFloor = Math.max(1, Math.floor(b.w / 2.5));
              return Array.from({ length: windowsPerFloor }).map((_, wi) => {
                const winW = (b.w * 0.7) / windowsPerFloor;
                const startX = x - (windowsPerFloor - 1) * winW / 2;
                return (
                  <mesh key={`fw-${fi}-${wi}`} position={[startX + wi * winW, floorH * fi + floorH * 0.55, z - b.d / 2 - 0.02]}>
                    <planeGeometry args={[winW * 0.7, floorH * 0.5]} />
                    <meshStandardMaterial color="#93c5fd" emissive="#60a5fa" emissiveIntensity={0.1} metalness={0.8} roughness={0.2} />
                  </mesh>
                );
              });
            })}

            {/* Windows - back face */}
            {Array.from({ length: b.floors }).map((_, fi) => {
              const windowsPerFloor = Math.max(1, Math.floor(b.w / 2.5));
              return Array.from({ length: windowsPerFloor }).map((_, wi) => {
                const winW = (b.w * 0.7) / windowsPerFloor;
                const startX = x - (windowsPerFloor - 1) * winW / 2;
                return (
                  <mesh key={`bw-${fi}-${wi}`} position={[startX + wi * winW, floorH * fi + floorH * 0.55, z + b.d / 2 + 0.02]} rotation={[0, Math.PI, 0]}>
                    <planeGeometry args={[winW * 0.7, floorH * 0.5]} />
                    <meshStandardMaterial color="#93c5fd" emissive="#60a5fa" emissiveIntensity={0.1} metalness={0.8} roughness={0.2} />
                  </mesh>
                );
              });
            })}

            {/* Windows - side faces */}
            {Array.from({ length: b.floors }).map((_, fi) => {
              const windowsPerFloor = Math.max(1, Math.floor(b.d / 2.5));
              return Array.from({ length: windowsPerFloor }).map((_, wi) => {
                const winW = (b.d * 0.7) / windowsPerFloor;
                const startZ = z - (windowsPerFloor - 1) * winW / 2;
                return (
                  <group key={`sw-${fi}-${wi}`}>
                    <mesh position={[x - b.w / 2 - 0.02, floorH * fi + floorH * 0.55, startZ + wi * winW]} rotation={[0, Math.PI / 2, 0]}>
                      <planeGeometry args={[winW * 0.7, floorH * 0.5]} />
                      <meshStandardMaterial color="#93c5fd" emissive="#60a5fa" emissiveIntensity={0.1} metalness={0.8} roughness={0.2} />
                    </mesh>
                    <mesh position={[x + b.w / 2 + 0.02, floorH * fi + floorH * 0.55, startZ + wi * winW]} rotation={[0, -Math.PI / 2, 0]}>
                      <planeGeometry args={[winW * 0.7, floorH * 0.5]} />
                      <meshStandardMaterial color="#93c5fd" emissive="#60a5fa" emissiveIntensity={0.1} metalness={0.8} roughness={0.2} />
                    </mesh>
                  </group>
                );
              });
            })}

            {/* Roof cornice */}
            <mesh position={[x, b.h + 0.15, z]}>
              <boxGeometry args={[b.w + 0.5, 0.3, b.d + 0.5]} />
              <meshStandardMaterial color="#374151" roughness={0.7} />
            </mesh>

            {/* Roof type */}
            {b.roofType === 'pointed' && (
              <mesh position={[x, b.h + 0.3 + b.w * 0.2, z]} castShadow>
                <coneGeometry args={[Math.min(b.w, b.d) * 0.6, b.w * 0.4, 4]} />
                <meshStandardMaterial color="#8b4513" roughness={0.9} />
              </mesh>
            )}

            {b.roofType === 'antenna' && (
              <group>
                {/* AC units on roof */}
                <mesh position={[x + 1, b.h + 0.6, z]} castShadow>
                  <boxGeometry args={[1.2, 0.8, 1.2]} />
                  <meshStandardMaterial color="#9ca3af" metalness={0.4} roughness={0.5} />
                </mesh>
                {/* Antenna */}
                <mesh position={[x - 1, b.h + 2, z]}>
                  <cylinderGeometry args={[0.05, 0.05, 4, 6]} />
                  <meshStandardMaterial color="#666666" metalness={0.6} />
                </mesh>
                {/* Antenna dish */}
                <mesh position={[x - 1, b.h + 3.5, z]} rotation={[0.3, 0, 0]}>
                  <sphereGeometry args={[0.3, 8, 8, 0, Math.PI]} />
                  <meshStandardMaterial color="#aaaaaa" metalness={0.7} roughness={0.3} />
                </mesh>
              </group>
            )}

            {/* Door at ground level */}
            <mesh position={[x, 1, z - b.d / 2 - 0.02]}>
              <planeGeometry args={[1.5, 2]} />
              <meshStandardMaterial color="#4a3728" roughness={0.9} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
};
