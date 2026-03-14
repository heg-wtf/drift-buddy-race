import * as THREE from "three";
import { useMemo } from "react";
import { useTrackContext } from "./tracks";

export const SPECTATOR_COLORS = [
  "#e63946",
  "#457b9d",
  "#f4a261",
  "#2a9d8f",
  "#e9c46a",
  "#264653",
  "#ff6b6b",
  "#6c5ce7",
  "#fd79a8",
  "#00b894",
  "#0984e3",
  "#fdcb6e",
  "#e17055",
  "#74b9ff",
  "#a29bfe",
  "#55efc4",
];
export const SKIN_TONES = [
  "#deb887",
  "#d2a679",
  "#c49a6c",
  "#f5d0a9",
  "#a0785a",
  "#8d5524",
];

// Grandstand at the start/finish line, OUTSIDE the track (right barrier side)
// Track center at x=40, right barrier at x≈50.3, so grandstand starts at x=56
export const StartGrandstand = () => {
  const { configuration } = useTrackContext();
  const { startGrandstand } = configuration.objectPositions;

  const meshes = useMemo(() => {
    const { rows, seatsPerRow, startX, startZ, facingRotation } =
      startGrandstand;
    const rot = startGrandstand.grandstandRotation ?? 0;
    const seatWidth = 1.6;
    const rowDepth = 1.8;
    const rowHeightStep = 1.1;
    const total = rows * seatsPerRow;

    // Center of grandstand (before rotation)
    const centerX = startX + (rows * rowDepth) / 2;
    const centerZ = startZ + (seatsPerRow * seatWidth) / 2;

    // Rotate point around center
    const cosR = Math.cos(rot);
    const sinR = Math.sin(rot);
    const rotatePoint = (lx: number, lz: number): [number, number] => {
      const dx = lx - centerX;
      const dz = lz - centerZ;
      return [centerX + dx * cosR - dz * sinR, centerZ + dx * sinR + dz * cosR];
    };

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    // Seats
    const seatGeo = new THREE.BoxGeometry(
      rowDepth * 0.85,
      0.25,
      seatWidth * 0.85,
    );
    const seatMat = new THREE.MeshStandardMaterial({
      color: "#555555",
      roughness: 0.8,
    });
    const seatMesh = new THREE.InstancedMesh(seatGeo, seatMat, total);

    // Bodies
    const bodyGeo = new THREE.CylinderGeometry(0.22, 0.18, 0.9, 6);
    const bodyMat = new THREE.MeshStandardMaterial({ roughness: 0.9 });
    const bodyMesh = new THREE.InstancedMesh(bodyGeo, bodyMat, total);

    // Heads
    const headGeo = new THREE.SphereGeometry(0.16, 6, 6);
    const headMat = new THREE.MeshStandardMaterial({ roughness: 0.7 });
    const headMesh = new THREE.InstancedMesh(headGeo, headMat, total);

    let idx = 0;
    for (let r = 0; r < rows; r++) {
      for (let s = 0; s < seatsPerRow; s++) {
        const localX = startX + r * rowDepth;
        const y = r * rowHeightStep + 0.12;
        const localZ = startZ + s * seatWidth;
        const [x, z] = rotatePoint(localX, localZ);

        // Seat
        dummy.position.set(x, y, z);
        dummy.rotation.set(0, rot, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        seatMesh.setMatrixAt(idx, dummy.matrix);

        // Body
        const hScale = 0.7 + Math.random() * 0.5;
        const bLocalX = localX + (Math.random() - 0.5) * 0.3;
        const bLocalZ = localZ + (Math.random() - 0.5) * 0.3;
        const [px, pz] = rotatePoint(bLocalX, bLocalZ);
        dummy.position.set(px, y + 0.6, pz);
        dummy.rotation.set(
          0,
          facingRotation + rot + (Math.random() - 0.5) * 0.4,
          0,
        );
        dummy.scale.set(1, hScale, 1);
        dummy.updateMatrix();
        bodyMesh.setMatrixAt(idx, dummy.matrix);
        color.set(
          SPECTATOR_COLORS[Math.floor(Math.random() * SPECTATOR_COLORS.length)],
        );
        bodyMesh.setColorAt(idx, color);

        // Head
        dummy.position.set(px, y + 0.6 + 0.5 * hScale, pz);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        headMesh.setMatrixAt(idx, dummy.matrix);
        color.set(SKIN_TONES[Math.floor(Math.random() * SKIN_TONES.length)]);
        headMesh.setColorAt(idx, color);

        idx++;
      }
    }

    seatMesh.instanceMatrix.needsUpdate = true;
    bodyMesh.instanceMatrix.needsUpdate = true;
    headMesh.instanceMatrix.needsUpdate = true;
    if (bodyMesh.instanceColor) bodyMesh.instanceColor.needsUpdate = true;
    if (headMesh.instanceColor) headMesh.instanceColor.needsUpdate = true;

    // Roof
    const roofW = rows * rowDepth + 2;
    const roofD = seatsPerRow * seatWidth + 2;
    const roofY = rows * rowHeightStep + 1.5;

    // Compute rotated roof/pillar positions
    const roofLocalX = startX + (rows * rowDepth) / 2;
    const roofLocalZ = startZ + (seatsPerRow * seatWidth) / 2 - seatWidth / 2;
    const [roofRX, roofRZ] = rotatePoint(roofLocalX, roofLocalZ);

    const pillarCorners = [
      [startX, startZ],
      [startX, startZ + (seatsPerRow - 1) * seatWidth],
      [startX + (rows - 1) * rowDepth, startZ],
      [startX + (rows - 1) * rowDepth, startZ + (seatsPerRow - 1) * seatWidth],
    ].map(([lx, lz]) => rotatePoint(lx, lz));

    return {
      seatMesh,
      bodyMesh,
      headMesh,
      roofW,
      roofD,
      roofY,
      roofRX,
      roofRZ,
      pillarCorners,
      rot,
    };
  }, [startGrandstand]);

  const { roofW, roofD, roofY, roofRX, roofRZ, pillarCorners } = meshes;

  return (
    <group>
      <primitive object={meshes.seatMesh} />
      <primitive object={meshes.bodyMesh} />
      <primitive object={meshes.headMesh} />
      {/* Roof */}
      <mesh position={[roofRX, roofY, roofRZ]} rotation={[0, meshes.rot, 0]}>
        <boxGeometry args={[roofW, 0.15, roofD]} />
        <meshStandardMaterial color="#2d3748" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* 4 pillars */}
      {pillarCorners.map(([px, pz], i) => (
        <mesh key={i} position={[px, roofY / 2, pz]}>
          <cylinderGeometry args={[0.1, 0.1, roofY, 6]} />
          <meshStandardMaterial color="#444444" metalness={0.3} />
        </mesh>
      ))}
    </group>
  );
};
