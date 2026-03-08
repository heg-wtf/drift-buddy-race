import * as THREE from 'three';
import { useMemo } from 'react';

interface GrandstandConfig {
  x: number;
  z: number;
  rotation: number; // facing direction
  rows: number;
  seatsPerRow: number;
  roofColor: string;
}

// All grandstand locations around the track (outside barriers)
const GRANDSTANDS: GrandstandConfig[] = [
  // Main grandstand at start/finish (right side)
  { x: 65, z: -15, rotation: -Math.PI / 2, rows: 6, seatsPerRow: 24, roofColor: '#333333' },
  // T1 outer
  { x: 90, z: 82, rotation: -0.8, rows: 4, seatsPerRow: 12, roofColor: '#2d3748' },
  // Bottom straight mid
  { x: 200, z: 108, rotation: 0, rows: 5, seatsPerRow: 18, roofColor: '#1a365d' },
  // T2 hairpin outer
  { x: 432, z: 90, rotation: Math.PI / 2, rows: 5, seatsPerRow: 14, roofColor: '#742a2a' },
  // Return straight
  { x: 300, z: 152, rotation: Math.PI, rows: 4, seatsPerRow: 16, roofColor: '#22543d' },
  // T3 area
  { x: 70, z: 140, rotation: 0.5, rows: 3, seatsPerRow: 10, roofColor: '#44337a' },
  // T4-T5 left side
  { x: -35, z: 115, rotation: 1.0, rows: 4, seatsPerRow: 12, roofColor: '#2d3748' },
  // T6-T7
  { x: -115, z: -35, rotation: 2.2, rows: 4, seatsPerRow: 10, roofColor: '#1a365d' },
  // T8 multi-apex
  { x: -148, z: -130, rotation: 2.8, rows: 5, seatsPerRow: 14, roofColor: '#742a2a' },
  // T9 top
  { x: -50, z: -195, rotation: -0.3, rows: 4, seatsPerRow: 12, roofColor: '#22543d' },
  // T10-T11
  { x: 20, z: -175, rotation: -0.4, rows: 3, seatsPerRow: 10, roofColor: '#44337a' },
  // T12
  { x: 110, z: -120, rotation: -1.2, rows: 4, seatsPerRow: 10, roofColor: '#2d3748' },
];

const SPECTATOR_COLORS = [
  '#e63946', '#457b9d', '#f4a261', '#2a9d8f', '#e9c46a', '#264653',
  '#ff6b6b', '#6c5ce7', '#fd79a8', '#00b894', '#0984e3', '#fdcb6e',
  '#e17055', '#74b9ff', '#a29bfe', '#55efc4', '#fab1a0', '#81ecec',
];

const SEAT_WIDTH = 1.8;
const ROW_DEPTH = 2.0;
const ROW_HEIGHT_STEP = 1.2;

export const Grandstand = () => {
  const meshes = useMemo(() => {
    // Count totals for instanced meshes
    let totalSeats = 0;
    let totalSpectators = 0;
    for (const g of GRANDSTANDS) {
      totalSeats += g.rows * g.seatsPerRow;
      totalSpectators += g.rows * g.seatsPerRow;
    }

    // Add standing crowd spots (groups of people standing near barriers)
    const standingCrowdCount = 200;
    const totalPeople = totalSpectators + standingCrowdCount;

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    // --- Seat platforms ---
    const seatGeo = new THREE.BoxGeometry(ROW_DEPTH * 0.9, 0.3, SEAT_WIDTH * 0.9);
    const seatMat = new THREE.MeshStandardMaterial({ color: '#555555', roughness: 0.8 });
    const seatMesh = new THREE.InstancedMesh(seatGeo, seatMat, totalSeats);

    // --- Spectators (body) ---
    const bodyGeo = new THREE.CylinderGeometry(0.25, 0.2, 1.0, 6);
    const bodyMat = new THREE.MeshStandardMaterial({ roughness: 0.9 });
    const bodyMesh = new THREE.InstancedMesh(bodyGeo, bodyMat, totalPeople);

    // --- Spectator heads ---
    const headGeo = new THREE.SphereGeometry(0.18, 6, 6);
    const headMat = new THREE.MeshStandardMaterial({ roughness: 0.7 });
    const headMesh = new THREE.InstancedMesh(headGeo, headMat, totalPeople);

    // --- Roof panels ---
    const roofPanels: THREE.Mesh[] = [];
    // --- Pillars ---
    const pillarData: { pos: THREE.Vector3; height: number }[] = [];

    let si = 0; // seat index
    let pi = 0; // person index

    const skinTones = ['#deb887', '#d2a679', '#c49a6c', '#f5d0a9', '#a0785a', '#8d5524'];

    for (const g of GRANDSTANDS) {
      const cosR = Math.cos(g.rotation);
      const sinR = Math.sin(g.rotation);

      for (let r = 0; r < g.rows; r++) {
        for (let s = 0; s < g.seatsPerRow; s++) {
          // Local position
          const localX = r * ROW_DEPTH;
          const localZ = s * SEAT_WIDTH - (g.seatsPerRow * SEAT_WIDTH) / 2;
          const y = r * ROW_HEIGHT_STEP + 0.15;

          // Rotate and translate
          const wx = g.x + localX * cosR - localZ * sinR;
          const wz = g.z + localX * sinR + localZ * cosR;

          // Seat
          dummy.position.set(wx, y, wz);
          dummy.rotation.set(0, g.rotation, 0);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          seatMesh.setMatrixAt(si++, dummy.matrix);

          // Person body
          const personY = y + 0.8;
          const ox = (Math.random() - 0.5) * 0.3;
          const oz = (Math.random() - 0.5) * 0.3;
          const px = wx + ox * cosR - oz * sinR;
          const pz = wz + ox * sinR + oz * cosR;
          const heightScale = 0.75 + Math.random() * 0.5;

          dummy.position.set(px, personY, pz);
          dummy.rotation.set(0, g.rotation + (Math.random() - 0.5) * 0.4, 0);
          dummy.scale.set(1, heightScale, 1);
          dummy.updateMatrix();
          bodyMesh.setMatrixAt(pi, dummy.matrix);
          color.set(SPECTATOR_COLORS[Math.floor(Math.random() * SPECTATOR_COLORS.length)]);
          bodyMesh.setColorAt(pi, color);

          // Head
          dummy.position.set(px, personY + 0.55 * heightScale, pz);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          headMesh.setMatrixAt(pi, dummy.matrix);
          color.set(skinTones[Math.floor(Math.random() * skinTones.length)]);
          headMesh.setColorAt(pi, color);

          pi++;
        }
      }

      // Roof
      const roofW = g.rows * ROW_DEPTH + 2;
      const roofD = g.seatsPerRow * SEAT_WIDTH + 2;
      const roofGeo = new THREE.BoxGeometry(roofW, 0.15, roofD);
      const roofMat = new THREE.MeshStandardMaterial({ color: g.roofColor, metalness: 0.5, roughness: 0.4 });
      const roof = new THREE.Mesh(roofGeo, roofMat);
      const roofLocalX = (g.rows * ROW_DEPTH) / 2;
      const roofY = g.rows * ROW_HEIGHT_STEP + 1.5;
      roof.position.set(
        g.x + roofLocalX * cosR,
        roofY,
        g.z + roofLocalX * sinR
      );
      roof.rotation.set(0, g.rotation, 0);
      roofPanels.push(roof);

      // 4 corner pillars
      const corners = [
        [0, -(g.seatsPerRow * SEAT_WIDTH) / 2],
        [0, (g.seatsPerRow * SEAT_WIDTH) / 2],
        [g.rows * ROW_DEPTH, -(g.seatsPerRow * SEAT_WIDTH) / 2],
        [g.rows * ROW_DEPTH, (g.seatsPerRow * SEAT_WIDTH) / 2],
      ];
      for (const [lx, lz] of corners) {
        pillarData.push({
          pos: new THREE.Vector3(
            g.x + lx * cosR - lz * sinR,
            roofY / 2,
            g.z + lx * sinR + lz * cosR
          ),
          height: roofY,
        });
      }
    }

    // Standing crowd near track edges (random clusters)
    const standingPositions: [number, number, number][] = [
      // Along bottom straight
      ...Array.from({ length: 30 }, (_, i) => [120 + i * 5, 0, 105 + Math.random() * 8] as [number, number, number]),
      // Along return straight
      ...Array.from({ length: 25 }, (_, i) => [130 + i * 5, 0, 150 + Math.random() * 8] as [number, number, number]),
      // Near start line left side
      ...Array.from({ length: 15 }, (_, i) => [25, 0, -10 + i * 3] as [number, number, number]),
      // T5-T6 corridor
      ...Array.from({ length: 15 }, (_, i) => [-60 - Math.random() * 10, 0, -5 + i * 4] as [number, number, number]),
      // T8 area
      ...Array.from({ length: 15 }, (_, i) => [-135 - Math.random() * 8, 0, -100 - i * 4] as [number, number, number]),
      // Top section T9-T11
      ...Array.from({ length: 20 }, (_, i) => [-40 + i * 5, 0, -185 - Math.random() * 8] as [number, number, number]),
      // T12-T13
      ...Array.from({ length: 15 }, (_, i) => [95 + Math.random() * 8, 0, -95 + i * 3] as [number, number, number]),
      // Extra near T2
      ...Array.from({ length: 15 }, (_, i) => [425 + Math.random() * 8, 0, 65 + i * 4] as [number, number, number]),
      // Near T4
      ...Array.from({ length: 15 }, (_, i) => [-20 - Math.random() * 8, 0, 75 + i * 3] as [number, number, number]),
      // Remaining scattered
      ...Array.from({ length: 15 }, () => [
        -130 + Math.random() * 10,
        0,
        -160 + Math.random() * 20,
      ] as [number, number, number]),
    ];

    for (let i = 0; i < standingCrowdCount && i < standingPositions.length; i++) {
      const [sx, , sz] = standingPositions[i];
      const heightScale = 0.7 + Math.random() * 0.6;

      dummy.position.set(sx, 0.5, sz);
      dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
      dummy.scale.set(1, heightScale, 1);
      dummy.updateMatrix();
      bodyMesh.setMatrixAt(pi, dummy.matrix);
      color.set(SPECTATOR_COLORS[Math.floor(Math.random() * SPECTATOR_COLORS.length)]);
      bodyMesh.setColorAt(pi, color);

      dummy.position.set(sx, 0.5 + 0.55 * heightScale, sz);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      headMesh.setMatrixAt(pi, dummy.matrix);
      color.set(skinTones[Math.floor(Math.random() * skinTones.length)]);
      headMesh.setColorAt(pi, color);

      pi++;
    }

    // Finalize
    seatMesh.instanceMatrix.needsUpdate = true;
    bodyMesh.instanceMatrix.needsUpdate = true;
    headMesh.instanceMatrix.needsUpdate = true;
    if (bodyMesh.instanceColor) bodyMesh.instanceColor.needsUpdate = true;
    if (headMesh.instanceColor) headMesh.instanceColor.needsUpdate = true;

    // Update counts to actual used
    bodyMesh.count = pi;
    headMesh.count = pi;

    return { seatMesh, bodyMesh, headMesh, roofPanels, pillarData };
  }, []);

  return (
    <group>
      <primitive object={meshes.seatMesh} />
      <primitive object={meshes.bodyMesh} />
      <primitive object={meshes.headMesh} />
      {meshes.roofPanels.map((roof, i) => (
        <primitive key={`roof-${i}`} object={roof} />
      ))}
      {meshes.pillarData.map((p, i) => (
        <mesh key={`pillar-${i}`} position={p.pos}>
          <cylinderGeometry args={[0.12, 0.12, p.height, 6]} />
          <meshStandardMaterial color="#444444" metalness={0.3} />
        </mesh>
      ))}
    </group>
  );
};
