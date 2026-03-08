import * as THREE from 'three';
import { useMemo } from 'react';

// Grandstand with virtual spectators near the start/finish line
export const Grandstand = () => {
  // Start line is at ~[40, -20] to [40, 40], track goes in +z
  // Outside of track at start is +x side (x ≈ 55+)
  
  const { standMesh, spectatorMesh, roofMesh } = useMemo(() => {
    const dummy = new THREE.Object3D();

    // --- Grandstand structure (tiered rows) ---
    const rows = 5;
    const seatsPerRow = 20;
    const standCount = rows * seatsPerRow;
    const seatWidth = 1.8;
    const rowDepth = 2.0;
    const rowHeightStep = 1.2;
    const standStartX = 62; // outside the right barrier
    const standStartZ = -15;

    // Stand platforms (each seat block)
    const standGeo = new THREE.BoxGeometry(rowDepth * 0.9, 0.3, seatWidth * 0.9);
    const standMat = new THREE.MeshStandardMaterial({ color: '#555555', roughness: 0.8 });
    const standMesh = new THREE.InstancedMesh(standGeo, standMat, standCount);

    let si = 0;
    for (let r = 0; r < rows; r++) {
      for (let s = 0; s < seatsPerRow; s++) {
        const x = standStartX + r * rowDepth;
        const y = r * rowHeightStep + 0.15;
        const z = standStartZ + s * seatWidth;
        dummy.position.set(x, y, z);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        standMesh.setMatrixAt(si++, dummy.matrix);
      }
    }
    standMesh.instanceMatrix.needsUpdate = true;

    // --- Spectators (simple capsule-like figures) ---
    const spectatorGeo = new THREE.CylinderGeometry(0.25, 0.2, 1.2, 6);
    const spectatorColors = ['#e63946', '#457b9d', '#f4a261', '#2a9d8f', '#e9c46a', '#264653', '#ff6b6b', '#6c5ce7'];
    
    // Use vertex colors for variety
    const spectatorMat = new THREE.MeshStandardMaterial({ vertexColors: false, roughness: 0.9 });
    const totalSpectators = rows * seatsPerRow;
    const spectatorMesh = new THREE.InstancedMesh(spectatorGeo, spectatorMat, totalSpectators);
    
    const color = new THREE.Color();
    let pi = 0;
    for (let r = 0; r < rows; r++) {
      for (let s = 0; s < seatsPerRow; s++) {
        const x = standStartX + r * rowDepth + (Math.random() - 0.5) * 0.4;
        const baseY = r * rowHeightStep + 0.3;
        const z = standStartZ + s * seatWidth + (Math.random() - 0.5) * 0.5;
        dummy.position.set(x, baseY + 0.6, z);
        dummy.scale.set(1, 0.8 + Math.random() * 0.4, 1);
        dummy.rotation.set(0, -Math.PI / 2 + (Math.random() - 0.5) * 0.3, 0);
        dummy.updateMatrix();
        spectatorMesh.setMatrixAt(pi, dummy.matrix);
        color.set(spectatorColors[Math.floor(Math.random() * spectatorColors.length)]);
        spectatorMesh.setColorAt(pi, color);
        pi++;
      }
    }
    spectatorMesh.instanceMatrix.needsUpdate = true;
    if (spectatorMesh.instanceColor) spectatorMesh.instanceColor.needsUpdate = true;

    // --- Roof structure ---
    const roofGeo = new THREE.BoxGeometry(rows * rowDepth + 2, 0.15, seatsPerRow * seatWidth + 2);
    const roofMat = new THREE.MeshStandardMaterial({ color: '#333333', metalness: 0.5, roughness: 0.4 });
    const roofMesh = new THREE.Mesh(roofGeo, roofMat);
    roofMesh.position.set(
      standStartX + (rows * rowDepth) / 2 - rowDepth / 2,
      rows * rowHeightStep + 1.5,
      standStartZ + (seatsPerRow * seatWidth) / 2 - seatWidth / 2
    );

    return { standMesh, spectatorMesh, roofMesh };
  }, []);

  return (
    <group>
      <primitive object={standMesh} />
      <primitive object={spectatorMesh} />
      <primitive object={roofMesh} />
      
      {/* Support pillars for roof */}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[
          62 + (i < 2 ? 0 : 4 * 2.0),
          3,
          -15 + (i % 2 === 0 ? 0 : 19 * 1.8)
        ]}>
          <cylinderGeometry args={[0.15, 0.15, 6, 8]} />
          <meshStandardMaterial color="#444444" metalness={0.3} />
        </mesh>
      ))}
    </group>
  );
};
