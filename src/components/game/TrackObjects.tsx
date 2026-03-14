import * as THREE from "three";
import { useMemo } from "react";
import { useTrackContext } from "./tracks";

// Deterministic pseudo-random from seed
const seededRandom = (seed: number) => {
  const x = Math.sin(seed * 127.1 + seed * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// Validate position is safe from ALL track segments (not just local)
const isPositionSafe = (
  x: number,
  z: number,
  radius: number,
  trackPoints: THREE.Vector3[],
  trackHalfWidth: number,
): boolean => {
  const minDistSquared = (trackHalfWidth + radius + 3) ** 2;
  for (let i = 0; i < trackPoints.length; i += 3) {
    const dx = x - trackPoints[i].x;
    const dz = z - trackPoints[i].z;
    if (dx * dx + dz * dz < minDistSquared) return false;
  }
  return true;
};

// Validate against DISTANT track segments only (for objects placed next to track)
const isSafeFromDistantTrack = (
  x: number,
  z: number,
  radius: number,
  trackPoints: THREE.Vector3[],
  sourceIndex: number,
  skipRange: number,
  trackHalfWidth: number,
): boolean => {
  const minDistSquared = (trackHalfWidth + radius + 3) ** 2;
  for (let i = 0; i < trackPoints.length; i += 3) {
    const indexDistance = Math.min(
      Math.abs(i - sourceIndex),
      trackPoints.length - Math.abs(i - sourceIndex),
    );
    if (indexDistance < skipRange) continue;
    const dx = x - trackPoints[i].x;
    const dz = z - trackPoints[i].z;
    if (dx * dx + dz * dz < minDistSquared) return false;
  }
  return true;
};

// Cameramen positioned outside corners of the track
export const Cameramen = () => {
  const { configuration } = useTrackContext();
  const cameramenPositions = configuration.objectPositions.cameramenPositions;
  const mesh = useMemo(() => {
    const positions = cameramenPositions;

    const count = positions.length;
    const bodyGeo = new THREE.CylinderGeometry(0.3, 0.25, 1.4, 6);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: "#1a1a2e",
      roughness: 0.8,
    });
    const bodyMesh = new THREE.InstancedMesh(bodyGeo, bodyMat, count);

    const headGeo = new THREE.SphereGeometry(0.22, 6, 6);
    const headMat = new THREE.MeshStandardMaterial({
      color: "#deb887",
      roughness: 0.7,
    });
    const headMesh = new THREE.InstancedMesh(headGeo, headMat, count);

    const camGeo = new THREE.BoxGeometry(0.5, 0.35, 0.7);
    const camMat = new THREE.MeshStandardMaterial({
      color: "#222222",
      metalness: 0.6,
      roughness: 0.3,
    });
    const camMesh = new THREE.InstancedMesh(camGeo, camMat, count);

    const tripodGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.2, 4);
    const tripodMat = new THREE.MeshStandardMaterial({
      color: "#333333",
      metalness: 0.4,
    });
    const tripodMesh = new THREE.InstancedMesh(tripodGeo, tripodMat, count * 3);

    const dummy = new THREE.Object3D();

    for (let i = 0; i < count; i++) {
      const [x, z, rot] = positions[i];

      dummy.position.set(x, 0.7, z);
      dummy.rotation.set(0, rot, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      bodyMesh.setMatrixAt(i, dummy.matrix);

      dummy.position.set(x, 1.6, z);
      dummy.updateMatrix();
      headMesh.setMatrixAt(i, dummy.matrix);

      const camOffX = x + Math.sin(rot) * 0.6;
      const camOffZ = z + Math.cos(rot) * 0.6;
      dummy.position.set(camOffX, 1.3, camOffZ);
      dummy.rotation.set(0, rot, 0);
      dummy.updateMatrix();
      camMesh.setMatrixAt(i, dummy.matrix);

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
  }, [cameramenPositions]);

  return (
    <group>
      <primitive object={mesh.bodyMesh} />
      <primitive object={mesh.headMesh} />
      <primitive object={mesh.camMesh} />
      <primitive object={mesh.tripodMesh} />
    </group>
  );
};

// DHL advertising billboards along the track (InstancedMesh — 3 draw calls)
export const TrackBillboards = () => {
  const { trackPath, configuration } = useTrackContext();
  const billboardStep = configuration.objectPositions.billboardStep;
  const trackHalfWidth = configuration.definition.trackWidth / 2;
  const samplePointCount = configuration.definition.samplePointCount;
  const meshes = useMemo(() => {
    const points = trackPath.getPoints(samplePointCount);

    const billboardData: { x: number; z: number; rotationY: number }[] = [];
    const step = billboardStep;

    for (let i = 0; i < points.length; i += step) {
      const prev = points[(i - 1 + points.length) % points.length];
      const next = points[(i + 1) % points.length];
      const current = points[i];
      const tangent = new THREE.Vector3().subVectors(next, prev).normalize();
      const perp = new THREE.Vector3(-tangent.z, 0, tangent.x);
      const rotationY = Math.atan2(tangent.x, tangent.z);

      // Alternate sides
      const side = seededRandom(i * 77) > 0.5 ? 1 : -1;
      const offset = trackHalfWidth + 2.5; // just outside barrier
      const pos = current.clone().addScaledVector(perp, offset * side);

      if (
        isSafeFromDistantTrack(pos.x, pos.z, 1, points, i, 60, trackHalfWidth)
      ) {
        billboardData.push({ x: pos.x, z: pos.z, rotationY });
      }
    }

    const count = billboardData.length;
    const dummy = new THREE.Object3D();

    // Create DHL canvas texture
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 160;
    const context = canvas.getContext("2d")!;
    // Yellow background
    context.fillStyle = "#FFCC00";
    context.fillRect(0, 0, 512, 160);
    // Red "DHL" text
    context.fillStyle = "#D40511";
    context.font = "bold 100px Arial, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("DHL", 256, 75);
    // Red stripe at bottom
    context.fillStyle = "#D40511";
    context.fillRect(0, 130, 512, 30);
    const texture = new THREE.CanvasTexture(canvas);

    // Sign board with DHL texture
    const boardMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(6, 1.8, 0.15),
      new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.4,
        metalness: 0.1,
      }),
      count,
    );

    for (let i = 0; i < count; i++) {
      const { x, z, rotationY: rot } = billboardData[i];

      // Board at height 2.2
      dummy.position.set(x, 2.2, z);
      dummy.rotation.set(0, rot, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      boardMesh.setMatrixAt(i, dummy.matrix);
    }

    boardMesh.instanceMatrix.needsUpdate = true;

    return { boardMesh };
  }, [trackPath, billboardStep, trackHalfWidth, samplePointCount]);

  return (
    <group>
      <primitive object={meshes.boardMesh} />
    </group>
  );
};

// AWS advertising billboards — 3 boards, black background with orange text
export const TrackBillboardsAWS = () => {
  const { trackPath, configuration } = useTrackContext();
  const awsBillboardTrackFractions =
    configuration.objectPositions.awsBillboardTrackFractions;
  const trackHalfWidth = configuration.definition.trackWidth / 2;
  const samplePointCount = configuration.definition.samplePointCount;
  const meshes = useMemo(() => {
    const points = trackPath.getPoints(samplePointCount);

    // Compute target indices from track fractions
    const targetIndices = awsBillboardTrackFractions.map((fraction) =>
      Math.round(fraction * samplePointCount),
    );
    const billboardData: { x: number; z: number; rotationY: number }[] = [];

    for (const i of targetIndices) {
      const idx = Math.min(i, points.length - 1);
      const prev = points[(idx - 1 + points.length) % points.length];
      const next = points[(idx + 1) % points.length];
      const current = points[idx];
      const tangent = new THREE.Vector3().subVectors(next, prev).normalize();
      const perp = new THREE.Vector3(-tangent.z, 0, tangent.x);
      const rotationY = Math.atan2(tangent.x, tangent.z);

      const side = seededRandom(idx * 33) > 0.5 ? 1 : -1;
      const offset = trackHalfWidth + 2.5;
      const pos = current.clone().addScaledVector(perp, offset * side);

      if (
        isSafeFromDistantTrack(pos.x, pos.z, 1, points, idx, 60, trackHalfWidth)
      ) {
        billboardData.push({ x: pos.x, z: pos.z, rotationY });
      }
    }

    const count = billboardData.length;
    const dummy = new THREE.Object3D();

    // Create AWS canvas texture — black background, orange text
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 160;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#232F3E";
    context.fillRect(0, 0, 512, 160);
    context.fillStyle = "#FF9900";
    context.font = "bold 100px Arial, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("AWS", 256, 75);
    // Orange stripe at bottom
    context.fillStyle = "#FF9900";
    context.fillRect(0, 130, 512, 30);
    const texture = new THREE.CanvasTexture(canvas);

    const boardMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(6, 1.8, 0.15),
      new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.4,
        metalness: 0.1,
      }),
      count,
    );

    for (let i = 0; i < count; i++) {
      const { x, z, rotationY: rot } = billboardData[i];
      dummy.position.set(x, 2.2, z);
      dummy.rotation.set(0, rot, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      boardMesh.setMatrixAt(i, dummy.matrix);
    }

    boardMesh.instanceMatrix.needsUpdate = true;
    return { boardMesh };
  }, [trackPath, awsBillboardTrackFractions, trackHalfWidth, samplePointCount]);

  return (
    <group>
      <primitive object={meshes.boardMesh} />
    </group>
  );
};

// Qatar Airways — single ground-level ad board near start straight
export const TrackAdBoards = () => {
  const { configuration } = useTrackContext();
  const adBoardPosition = configuration.objectPositions.adBoardPosition;
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 64;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#5b0e2d";
    context.fillRect(0, 0, 512, 64);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, 512, 2);
    context.fillRect(0, 62, 512, 2);
    context.font = "bold 28px Arial, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("QATAR AIRWAYS", 256, 32);
    return new THREE.CanvasTexture(canvas);
  }, []);

  return (
    <mesh position={adBoardPosition} rotation={[0, 0, 0]}>
      <boxGeometry args={[0.05, 0.7, 8]} />
      <meshStandardMaterial map={texture} roughness={0.5} metalness={0.05} />
    </mesh>
  );
};

// Trees placed along track — InstancedMesh for performance (only 2 draw calls)
export const TrackTrees = () => {
  const { trackPath, configuration } = useTrackContext();
  const trackHalfWidth = configuration.definition.trackWidth / 2;
  const samplePointCount = configuration.definition.samplePointCount;
  const startPoint = configuration.definition.controlPoints[0];
  const meshes = useMemo(() => {
    const points = trackPath.getPoints(samplePointCount);

    const treeData: { x: number; z: number; scale: number }[] = [];
    const step = 6;

    for (let i = 0; i < points.length; i += step) {
      const prev = points[(i - 1 + points.length) % points.length];
      const next = points[(i + 1) % points.length];
      const current = points[i];
      const tangent = new THREE.Vector3().subVectors(next, prev).normalize();
      const perp = new THREE.Vector3(-tangent.z, 0, tangent.x);

      for (const side of [1, -1] as const) {
        const rand = seededRandom(i * 100 + (side > 0 ? 0 : 50));
        const offset = trackHalfWidth + 4 + rand * 5;
        const pos = current.clone().addScaledVector(perp, offset * side);

        // Skip trees near start/finish area
        const distanceToStart = Math.sqrt(
          (pos.x - startPoint[0]) ** 2 + (pos.z - startPoint[1]) ** 2,
        );
        if (
          distanceToStart > 40 &&
          isPositionSafe(pos.x, pos.z, 2, points, trackHalfWidth)
        ) {
          treeData.push({
            x: pos.x,
            z: pos.z,
            scale: 0.7 + seededRandom(i * 200 + side) * 0.8,
          });
        }
      }
    }

    const count = treeData.length;
    const dummy = new THREE.Object3D();

    const trunkMesh = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.25, 0.35, 3, 6),
      new THREE.MeshStandardMaterial({ color: "#5a3a1a", roughness: 0.9 }),
      count,
    );

    const canopyMesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1.5, 6, 5),
      new THREE.MeshStandardMaterial({ color: "#2d6b1e", roughness: 0.85 }),
      count,
    );

    for (let i = 0; i < count; i++) {
      const { x, z, scale } = treeData[i];

      dummy.position.set(x, 1.5 * scale, z);
      dummy.scale.set(scale, scale, scale);
      dummy.rotation.set(0, seededRandom(i * 300) * Math.PI * 2, 0);
      dummy.updateMatrix();
      trunkMesh.setMatrixAt(i, dummy.matrix);

      dummy.position.set(x, 3.5 * scale, z);
      dummy.updateMatrix();
      canopyMesh.setMatrixAt(i, dummy.matrix);
    }

    trunkMesh.instanceMatrix.needsUpdate = true;
    canopyMesh.instanceMatrix.needsUpdate = true;

    return { trunkMesh, canopyMesh };
  }, [trackPath, trackHalfWidth, samplePointCount, startPoint]);

  return (
    <group>
      <primitive object={meshes.trunkMesh} />
      <primitive object={meshes.canopyMesh} />
    </group>
  );
};

// Generate a building facade texture with varied windows and a door
const createFacadeTexture = (
  wallColor: string,
  floors: number,
  windowColumns: number,
  style: number,
  hasDoor: boolean,
) => {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d")!;
  const seed =
    style * 137 + floors * 53 + windowColumns * 17 + (hasDoor ? 7 : 0);

  // Wall base
  context.fillStyle = wallColor;
  context.fillRect(0, 0, 256, 256);

  // Random wall texture: brick lines or stucco cracks
  const wallDetail = seededRandom(seed + 999);
  if (wallDetail < 0.3) {
    // Brick pattern
    context.strokeStyle = "rgba(0,0,0,0.06)";
    context.lineWidth = 0.5;
    const brickH = 8;
    for (let row = 0; row < 256 / brickH; row++) {
      const y = row * brickH;
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(256, y);
      context.stroke();
      const brickW = 16;
      const offsetX = row % 2 === 0 ? 0 : brickW / 2;
      for (let bx = offsetX; bx < 256; bx += brickW) {
        context.beginPath();
        context.moveTo(bx, y);
        context.lineTo(bx, y + brickH);
        context.stroke();
      }
    }
  } else if (wallDetail < 0.5) {
    // Horizontal siding
    context.strokeStyle = "rgba(0,0,0,0.04)";
    context.lineWidth = 0.5;
    for (let y = 0; y < 256; y += 6) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(256, y);
      context.stroke();
    }
  }

  // Floor separator lines
  context.strokeStyle = "rgba(0,0,0,0.1)";
  context.lineWidth = 1;
  const floorHeight = 256 / floors;
  for (let f = 1; f < floors; f++) {
    const lineY = f * floorHeight;
    context.beginPath();
    context.moveTo(0, lineY);
    context.lineTo(256, lineY);
    context.stroke();
  }

  // Per-window randomization
  const glassColors = [
    "#6aafe6",
    "#5b9bd5",
    "#7ec8e3",
    "#4a8ab5",
    "#88c8ee",
    "#3d7ea6",
  ];
  const frameColors = ["#555555", "#444444", "#3a3a3a", "#666666", "#4d4d4d"];
  const curtainColors = [
    "#e8d5a8",
    "#d4a574",
    "#c9e4f0",
    "#f0d0d0",
    "#d5e8d0",
    "#e0d0f0",
  ];
  const shutterColors = ["#2e5e3e", "#4a3528", "#3b4a6b", "#6b3b3b"];

  const margin = 20;
  const baseGapX = (256 - margin * 2) / windowColumns;

  for (let f = 0; f < floors; f++) {
    // Each floor can have slightly different window sizing
    const floorSeed = seed + f * 31;
    const floorWidthVariation = 0.85 + seededRandom(floorSeed + 1) * 0.3;
    const floorHeightVariation = 0.7 + seededRandom(floorSeed + 2) * 0.5;
    const windowWidth = baseGapX * 0.55 * floorWidthVariation;
    const windowHeight = floorHeight * 0.45 * floorHeightVariation;
    const floorY = f * floorHeight + floorHeight * 0.18;

    for (let c = 0; c < windowColumns; c++) {
      const cellSeed = seed + f * 100 + c * 7;

      // Skip door position
      if (hasDoor && f === floors - 1 && c === Math.floor(windowColumns / 2))
        continue;

      // Random: ~12% chance window is missing (boarded up or blank wall)
      if (seededRandom(cellSeed + 50) < 0.12) {
        // Blank patch or boarded-up window
        if (seededRandom(cellSeed + 51) > 0.5) {
          const windowX = margin + c * baseGapX + (baseGapX - windowWidth) / 2;
          context.fillStyle = "rgba(0,0,0,0.05)";
          context.fillRect(windowX, floorY, windowWidth, windowHeight);
        }
        continue;
      }

      // Slight horizontal jitter per window
      const jitterX = (seededRandom(cellSeed + 60) - 0.5) * 3;
      const windowX =
        margin + c * baseGapX + (baseGapX - windowWidth) / 2 + jitterX;

      // Pick per-window colors
      const glassColor =
        glassColors[
          Math.floor(seededRandom(cellSeed + 10) * glassColors.length)
        ];
      const frameColor =
        frameColors[
          Math.floor(seededRandom(cellSeed + 20) * frameColors.length)
        ];

      // Window frame
      context.fillStyle = frameColor;
      context.fillRect(
        windowX - 2,
        floorY - 2,
        windowWidth + 4,
        windowHeight + 4,
      );

      // Glass
      context.fillStyle = glassColor;
      context.fillRect(windowX, floorY, windowWidth, windowHeight);

      // Divider style varies per window
      const dividerType = Math.floor(seededRandom(cellSeed + 30) * 5);
      context.strokeStyle = frameColor;
      context.lineWidth = 1.5;
      if (dividerType === 0) {
        // Cross
        context.beginPath();
        context.moveTo(windowX + windowWidth / 2, floorY);
        context.lineTo(windowX + windowWidth / 2, floorY + windowHeight);
        context.moveTo(windowX, floorY + windowHeight / 2);
        context.lineTo(windowX + windowWidth, floorY + windowHeight / 2);
        context.stroke();
      } else if (dividerType === 1) {
        // Horizontal only
        context.beginPath();
        context.moveTo(windowX, floorY + windowHeight * 0.4);
        context.lineTo(windowX + windowWidth, floorY + windowHeight * 0.4);
        context.stroke();
      } else if (dividerType === 2) {
        // Triple vertical
        for (let v = 1; v <= 2; v++) {
          context.beginPath();
          context.moveTo(windowX + (windowWidth * v) / 3, floorY);
          context.lineTo(
            windowX + (windowWidth * v) / 3,
            floorY + windowHeight,
          );
          context.stroke();
        }
      }
      // dividerType 3,4: no divider (plain glass)

      // ~25% chance: visible curtain on one side
      if (seededRandom(cellSeed + 40) < 0.25) {
        const curtainColor =
          curtainColors[
            Math.floor(seededRandom(cellSeed + 41) * curtainColors.length)
          ];
        const curtainSide = seededRandom(cellSeed + 42) > 0.5 ? 0 : 1;
        const curtainWidth =
          windowWidth * (0.25 + seededRandom(cellSeed + 43) * 0.2);
        context.fillStyle = curtainColor;
        if (curtainSide === 0) {
          context.fillRect(windowX, floorY, curtainWidth, windowHeight);
        } else {
          context.fillRect(
            windowX + windowWidth - curtainWidth,
            floorY,
            curtainWidth,
            windowHeight,
          );
        }
      }

      // ~15% chance: shutters
      if (seededRandom(cellSeed + 55) < 0.15) {
        const shutterColor =
          shutterColors[
            Math.floor(seededRandom(cellSeed + 56) * shutterColors.length)
          ];
        const shutterWidth = 4;
        context.fillStyle = shutterColor;
        context.fillRect(
          windowX - shutterWidth - 2,
          floorY - 2,
          shutterWidth,
          windowHeight + 4,
        );
        context.fillRect(
          windowX + windowWidth + 2,
          floorY - 2,
          shutterWidth,
          windowHeight + 4,
        );
      }

      // ~20% chance: AC unit below window
      if (seededRandom(cellSeed + 65) < 0.2 && f < floors - 1) {
        context.fillStyle = "#b0b0b0";
        const acWidth = windowWidth * 0.5;
        context.fillRect(
          windowX + windowWidth / 2 - acWidth / 2,
          floorY + windowHeight + 2,
          acWidth,
          6,
        );
        context.fillStyle = "#888888";
        context.fillRect(
          windowX + windowWidth / 2 - acWidth / 2,
          floorY + windowHeight + 2,
          acWidth,
          2,
        );
      }

      // Lit window glow — warm yellow or cool blue
      if (seededRandom(cellSeed + 70) > 0.55) {
        const isWarm = seededRandom(cellSeed + 71) > 0.3;
        context.fillStyle = isWarm
          ? "rgba(255, 220, 130, 0.2)"
          : "rgba(180, 210, 255, 0.12)";
        context.fillRect(windowX, floorY, windowWidth, windowHeight);
      }

      // ~10% chance: flower box / ledge under window
      if (seededRandom(cellSeed + 80) < 0.1) {
        context.fillStyle = "#5a3a1a";
        context.fillRect(
          windowX - 1,
          floorY + windowHeight + 1,
          windowWidth + 2,
          3,
        );
        // Small colored dots for flowers
        const flowerColors = ["#e74c3c", "#f39c12", "#e91e63", "#9b59b6"];
        for (let fl = 0; fl < 4; fl++) {
          context.fillStyle =
            flowerColors[
              Math.floor(seededRandom(cellSeed + 81 + fl) * flowerColors.length)
            ];
          context.beginPath();
          context.arc(
            windowX + 3 + fl * (windowWidth / 4),
            floorY + windowHeight + 1,
            2,
            0,
            Math.PI * 2,
          );
          context.fill();
        }
      }
    }
  }

  // Door at ground floor center
  if (hasDoor) {
    const doorSeed = seed + 500;
    const doorStyle = Math.floor(seededRandom(doorSeed) * 4);
    const doorWidth = baseGapX * (0.6 + seededRandom(doorSeed + 1) * 0.3);
    const doorHeight = floorHeight * (0.65 + seededRandom(doorSeed + 2) * 0.2);
    const doorX = 128 - doorWidth / 2;
    const doorY = 256 - doorHeight;

    const doorColors = ["#6b4226", "#4a4a4a", "#2c3e50", "#8b0000", "#1a3c2a"];
    const doorColor =
      doorColors[Math.floor(seededRandom(doorSeed + 3) * doorColors.length)];

    // Door frame
    context.fillStyle = "#3a3028";
    context.fillRect(doorX - 3, doorY - 3, doorWidth + 6, doorHeight + 3);

    // Door body
    context.fillStyle = doorColor;
    context.fillRect(doorX, doorY, doorWidth, doorHeight);

    if (doorStyle === 0) {
      // Panel door
      const pw = doorWidth / 2 - 6;
      const ph = doorHeight * 0.36;
      context.strokeStyle = "rgba(0,0,0,0.3)";
      context.lineWidth = 1.5;
      context.strokeRect(doorX + 4, doorY + 6, pw, ph);
      context.strokeRect(doorX + doorWidth / 2 + 2, doorY + 6, pw, ph);
      context.strokeRect(doorX + 4, doorY + doorHeight * 0.48, pw, ph);
      context.strokeRect(
        doorX + doorWidth / 2 + 2,
        doorY + doorHeight * 0.48,
        pw,
        ph,
      );
    } else if (doorStyle === 1) {
      // Glass door with frame
      context.fillStyle = "rgba(150, 200, 240, 0.4)";
      context.fillRect(doorX + 4, doorY + 4, doorWidth - 8, doorHeight * 0.6);
      context.strokeStyle = frameColors[0];
      context.lineWidth = 2;
      context.strokeRect(doorX + 4, doorY + 4, doorWidth - 8, doorHeight * 0.6);
      context.beginPath();
      context.moveTo(doorX + doorWidth / 2, doorY + 4);
      context.lineTo(doorX + doorWidth / 2, doorY + 4 + doorHeight * 0.6);
      context.stroke();
    } else if (doorStyle === 2) {
      // Arched top
      context.fillStyle = "rgba(100, 160, 200, 0.35)";
      context.beginPath();
      context.arc(
        doorX + doorWidth / 2,
        doorY + doorWidth / 2,
        doorWidth / 2 - 4,
        Math.PI,
        0,
      );
      context.lineTo(doorX + doorWidth - 4, doorY + doorHeight * 0.5);
      context.lineTo(doorX + 4, doorY + doorHeight * 0.5);
      context.closePath();
      context.fill();
    } else {
      // Simple with horizontal lines
      context.strokeStyle = "rgba(0,0,0,0.2)";
      context.lineWidth = 1;
      for (let li = 1; li <= 3; li++) {
        const ly = doorY + (doorHeight * li) / 4;
        context.beginPath();
        context.moveTo(doorX + 3, ly);
        context.lineTo(doorX + doorWidth - 3, ly);
        context.stroke();
      }
    }

    // Door handle
    context.fillStyle =
      seededRandom(doorSeed + 10) > 0.5 ? "#c4a84a" : "#aaaaaa";
    context.beginPath();
    context.arc(
      doorX + doorWidth * 0.78,
      doorY + doorHeight * 0.52,
      3,
      0,
      Math.PI * 2,
    );
    context.fill();

    // ~50% chance: transom / awning above door
    if (seededRandom(doorSeed + 20) > 0.5) {
      context.fillStyle = "rgba(200, 220, 255, 0.35)";
      context.fillRect(doorX, doorY - 10, doorWidth, 8);
      context.strokeStyle = "#444";
      context.lineWidth = 0.5;
      context.strokeRect(doorX, doorY - 10, doorWidth, 8);
    }

    // ~30% chance: house number
    if (seededRandom(doorSeed + 30) < 0.3) {
      const num = Math.floor(seededRandom(doorSeed + 31) * 200) + 1;
      context.fillStyle = "#ffffff";
      context.font = "bold 8px Arial";
      context.textAlign = "center";
      context.fillText(String(num), doorX + doorWidth / 2, doorY - 4);
    }
  }

  return new THREE.CanvasTexture(canvas);
};

// Buildings procedurally placed along track with safe-distance validation
export const TrackBuildings = () => {
  const { trackPath, configuration } = useTrackContext();
  const trackHalfWidth = configuration.definition.trackWidth / 2;
  const samplePointCount = configuration.definition.samplePointCount;
  const isJapanese =
    configuration.definition.identifier === "tokyo-city-circuit";
  const buildings = useMemo(() => {
    const points = trackPath.getPoints(samplePointCount);

    const isJapaneseTrack = isJapanese;
    const colors = isJapaneseTrack
      ? [
          "#8b1a1a", // 朱赤 (shrine red)
          "#2a1a0a", // 焦げ茶 (dark wood)
          "#1a1a18", // 墨色 (sumi black)
          "#6b3a2a", // 栗色 (chestnut)
          "#e8d8c0", // 白壁 (white plaster)
          "#3a2a1a", // 濃茶 (dark brown)
          "#c8a060", // 金茶 (golden brown)
          "#4a3020", // 古木 (aged wood)
          "#7a2020", // 弁柄 (bengara red)
          "#f0e8d0", // 漆喰 (stucco)
        ]
      : [
          "#d4c5a9",
          "#c9b896",
          "#bfae8c",
          "#d1c4a5",
          "#c4b698",
          "#b8a988",
          "#c2b393",
          "#ccbda0",
          "#a89880",
          "#b5a58d",
          "#e8dcc8",
          "#c7c0b0",
          "#ddd5c5",
        ];
    const roofTypes: ("flat" | "pointed" | "antenna" | "ac_unit")[] =
      isJapaneseTrack
        ? ["pointed", "pointed", "pointed", "flat", "pointed", "pointed"]
        : ["flat", "pointed", "antenna", "flat", "flat", "ac_unit"];

    type BuildingDefinition = {
      pos: [number, number];
      rotation: number;
      w: number;
      h: number;
      d: number;
      color: string;
      roofType: "flat" | "pointed" | "antenna" | "ac_unit";
      floors: number;
      windowColumns: number;
      style: number;
    };

    const defs: BuildingDefinition[] = [];
    const buildingStep = 18;

    for (let i = 0; i < points.length; i += buildingStep) {
      const prev = points[(i - 1 + points.length) % points.length];
      const next = points[(i + 1) % points.length];
      const current = points[i];
      const tangent = new THREE.Vector3().subVectors(next, prev).normalize();
      const perp = new THREE.Vector3(-tangent.z, 0, tangent.x);
      const buildingRotation = Math.atan2(tangent.x, tangent.z);

      for (const side of [1, -1] as const) {
        if (seededRandom(i * 70 + side) < 0.2) continue;

        const r1 = seededRandom(i * 10 + (side > 0 ? 0 : 5));
        const r2 = seededRandom(i * 20 + (side > 0 ? 0 : 15));
        const r3 = seededRandom(i * 30 + (side > 0 ? 0 : 25));

        const w = 6 + r1 * 8;
        const h = 8 + r2 * 16;
        const d = 6 + r3 * 6;
        const halfDiagonal = Math.sqrt(w * w + d * d) / 2;
        const floors = Math.max(2, Math.floor(h / 3.5));
        const windowColumns = Math.max(2, Math.floor(w / 2.5));
        const style = Math.floor(seededRandom(i * 60 + side) * 6);

        const offset = trackHalfWidth + halfDiagonal + 6 + r1 * 4;
        const pos = current.clone().addScaledVector(perp, offset * side);

        if (
          isPositionSafe(pos.x, pos.z, halfDiagonal, points, trackHalfWidth)
        ) {
          defs.push({
            pos: [pos.x, pos.z],
            rotation: buildingRotation + (side > 0 ? 0 : Math.PI),
            w,
            h,
            d,
            color:
              colors[Math.floor(seededRandom(i * 40 + side) * colors.length)],
            roofType:
              roofTypes[
                Math.floor(seededRandom(i * 50 + side) * roofTypes.length)
              ],
            floors,
            windowColumns,
            style,
          });
        }
      }
    }

    return defs;
  }, [trackPath, trackHalfWidth, samplePointCount]);

  // Pre-generate facade textures (cached per unique combo)
  const facadeTextures = useMemo(() => {
    const cache = new Map<string, THREE.CanvasTexture>();
    return buildings.map((b) => {
      const keyFront = `${b.color}-${b.floors}-${b.windowColumns}-${b.style}-door`;
      const keySide = `${b.color}-${b.floors}-${Math.max(2, Math.floor(b.d / 2.5))}-${b.style}-nodoor`;
      if (!cache.has(keyFront)) {
        cache.set(
          keyFront,
          createFacadeTexture(
            b.color,
            b.floors,
            b.windowColumns,
            b.style,
            true,
          ),
        );
      }
      if (!cache.has(keySide)) {
        cache.set(
          keySide,
          createFacadeTexture(
            b.color,
            b.floors,
            Math.max(2, Math.floor(b.d / 2.5)),
            b.style,
            false,
          ),
        );
      }
      return { front: cache.get(keyFront)!, side: cache.get(keySide)! };
    });
  }, [buildings]);

  return (
    <group>
      {buildings.map((b, i) => {
        const x = b.pos[0];
        const z = b.pos[1];
        const textures = facadeTextures[i];
        return (
          <group key={i}>
            {/* Main structure (invisible base — facades cover it) */}
            <mesh position={[x, b.h / 2, z]} castShadow receiveShadow>
              <boxGeometry args={[b.w, b.h, b.d]} />
              <meshStandardMaterial color={b.color} roughness={0.85} />
            </mesh>

            {/* Front facade (with door) */}
            <mesh position={[x, b.h / 2, z - b.d / 2 - 0.02]}>
              <planeGeometry args={[b.w, b.h]} />
              <meshStandardMaterial
                map={textures.front}
                emissiveMap={textures.front}
                emissive="#ffcc66"
                emissiveIntensity={0.4}
                side={THREE.DoubleSide}
              />
            </mesh>

            {/* Back facade (with door) */}
            <mesh
              position={[x, b.h / 2, z + b.d / 2 + 0.02]}
              rotation={[0, Math.PI, 0]}
            >
              <planeGeometry args={[b.w, b.h]} />
              <meshStandardMaterial
                map={textures.front}
                emissiveMap={textures.front}
                emissive="#ffcc66"
                emissiveIntensity={0.4}
                side={THREE.DoubleSide}
              />
            </mesh>

            {/* Left side facade */}
            <mesh
              position={[x - b.w / 2 - 0.02, b.h / 2, z]}
              rotation={[0, Math.PI / 2, 0]}
            >
              <planeGeometry args={[b.d, b.h]} />
              <meshStandardMaterial
                map={textures.side}
                emissiveMap={textures.side}
                emissive="#ffcc66"
                emissiveIntensity={0.4}
                side={THREE.DoubleSide}
              />
            </mesh>

            {/* Right side facade */}
            <mesh
              position={[x + b.w / 2 + 0.02, b.h / 2, z]}
              rotation={[0, -Math.PI / 2, 0]}
            >
              <planeGeometry args={[b.d, b.h]} />
              <meshStandardMaterial
                map={textures.side}
                emissiveMap={textures.side}
                emissive="#ffcc66"
                emissiveIntensity={0.4}
                side={THREE.DoubleSide}
              />
            </mesh>

            {/* Roof cornice */}
            <mesh position={[x, b.h + 0.15, z]}>
              <boxGeometry args={[b.w + 0.5, 0.3, b.d + 0.5]} />
              <meshStandardMaterial color="#374151" roughness={0.7} />
            </mesh>

            {/* Roof details */}
            {b.roofType === "pointed" && !isJapanese && (
              <mesh position={[x, b.h + 0.3 + b.w * 0.2, z]} castShadow>
                <coneGeometry args={[Math.min(b.w, b.d) * 0.6, b.w * 0.4, 4]} />
                <meshStandardMaterial color="#8b4513" roughness={0.9} />
              </mesh>
            )}
            {b.roofType === "pointed" && isJapanese && (
              <group>
                {/* 入母屋 (irimoya) shrine roof — wide overhang */}
                <mesh position={[x, b.h + 0.15, z]} castShadow>
                  <boxGeometry args={[b.w * 1.3, 0.3, b.d * 1.3]} />
                  <meshStandardMaterial
                    color="#1a1a18"
                    roughness={0.8}
                    metalness={0.2}
                  />
                </mesh>
                <mesh position={[x, b.h + 0.6 + b.w * 0.15, z]} castShadow>
                  <coneGeometry
                    args={[Math.min(b.w, b.d) * 0.7, b.w * 0.3, 4]}
                  />
                  <meshStandardMaterial
                    color="#1a1a18"
                    roughness={0.8}
                    metalness={0.2}
                  />
                </mesh>
                {/* 鬼瓦 (onigawara) ridge ornament */}
                <mesh position={[x, b.h + 0.8 + b.w * 0.15, z]}>
                  <sphereGeometry args={[0.4, 6, 6]} />
                  <meshStandardMaterial
                    color="#c8a060"
                    metalness={0.4}
                    roughness={0.5}
                  />
                </mesh>
              </group>
            )}

            {b.roofType === "antenna" && (
              <mesh position={[x - 1, b.h + 2, z]}>
                <cylinderGeometry args={[0.05, 0.05, 4, 6]} />
                <meshStandardMaterial color="#666666" metalness={0.6} />
              </mesh>
            )}

            {b.roofType === "ac_unit" && (
              <mesh position={[x + b.w * 0.2, b.h + 0.5, z - b.d * 0.2]}>
                <boxGeometry args={[1.5, 0.8, 1.2]} />
                <meshStandardMaterial
                  color="#aaaaaa"
                  metalness={0.4}
                  roughness={0.5}
                />
              </mesh>
            )}

            {/* Ground-level awning on front (50% chance) */}
            {b.style % 2 === 0 && (
              <mesh
                position={[x, 0.15, z - b.d / 2 - 0.6]}
                rotation={[-0.15, 0, 0]}
              >
                <boxGeometry args={[b.w * 0.6, 0.08, 1.0]} />
                <meshStandardMaterial
                  color={b.style % 4 === 0 ? "#c0392b" : "#2c6e49"}
                  roughness={0.8}
                />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
};

// Tokyo Tower — iconic red/white lattice tower
export const TokyoTower = () => {
  const { configuration } = useTrackContext();
  const towerLandmark = useMemo(
    () =>
      configuration.objectPositions.landmarks.find(
        (l) => l.type === "tokyo-tower",
      ),
    [configuration.objectPositions.landmarks],
  );

  if (!towerLandmark) return null;

  const pos = towerLandmark.position;
  const rot = towerLandmark.rotation ?? 0;
  const towerHeight = 80;
  const red = "#cc3333";
  const white = "#f0f0f0";

  return (
    <group position={[pos[0], 0, pos[2]]} rotation={[0, rot, 0]}>
      {/* Four legs tapering inward */}
      {[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([lx, lz], i) => (
        <mesh
          key={`leg-${i}`}
          position={[lx * 5, towerHeight * 0.22, lz * 5]}
          rotation={[lz * 0.18, 0, -lx * 0.18]}
        >
          <cylinderGeometry args={[0.5, 1.2, towerHeight * 0.45, 8]} />
          <meshStandardMaterial color={red} metalness={0.4} roughness={0.5} />
        </mesh>
      ))}

      {/* Main body — lower section (red) */}
      <mesh position={[0, towerHeight * 0.35, 0]}>
        <cylinderGeometry args={[2.5, 6, towerHeight * 0.25, 8]} />
        <meshStandardMaterial color={red} metalness={0.4} roughness={0.5} />
      </mesh>

      {/* Lower observation deck */}
      <mesh position={[0, towerHeight * 0.45, 0]}>
        <boxGeometry args={[9, 1.5, 9]} />
        <meshStandardMaterial color={white} metalness={0.3} roughness={0.4} />
      </mesh>

      {/* Observation deck windows */}
      {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((angle, i) => (
        <mesh
          key={`obs-win-${i}`}
          position={[
            Math.sin(angle) * 4.55,
            towerHeight * 0.45,
            Math.cos(angle) * 4.55,
          ]}
          rotation={[0, angle, 0]}
        >
          <planeGeometry args={[7, 1.2]} />
          <meshStandardMaterial
            color="#88ccff"
            emissive="#ffd060"
            emissiveIntensity={0.5}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}

      {/* Mid section (red/white stripes) */}
      {Array.from({ length: 6 }).map((_, i) => (
        <mesh key={`mid-${i}`} position={[0, towerHeight * 0.48 + i * 3, 0]}>
          <cylinderGeometry args={[2.2 - i * 0.15, 2.5 - i * 0.15, 2.8, 8]} />
          <meshStandardMaterial
            color={i % 2 === 0 ? red : white}
            metalness={0.4}
            roughness={0.5}
          />
        </mesh>
      ))}

      {/* Upper observation deck */}
      <mesh position={[0, towerHeight * 0.72, 0]}>
        <boxGeometry args={[5, 1.2, 5]} />
        <meshStandardMaterial color={white} metalness={0.3} roughness={0.4} />
      </mesh>

      {/* Upper section (red) */}
      <mesh position={[0, towerHeight * 0.82, 0]}>
        <cylinderGeometry args={[0.8, 1.5, towerHeight * 0.18, 8]} />
        <meshStandardMaterial color={red} metalness={0.4} roughness={0.5} />
      </mesh>

      {/* Antenna spire */}
      <mesh position={[0, towerHeight * 0.96, 0]}>
        <cylinderGeometry args={[0.15, 0.4, towerHeight * 0.1, 6]} />
        <meshStandardMaterial color={white} metalness={0.5} roughness={0.3} />
      </mesh>

      {/* Antenna tip */}
      <mesh position={[0, towerHeight * 1.02, 0]}>
        <coneGeometry args={[0.1, 2, 6]} />
        <meshStandardMaterial color={red} metalness={0.5} roughness={0.3} />
      </mesh>

      {/* Cross beams (lattice effect) */}
      {Array.from({ length: 8 }).map((_, i) => {
        const y = 5 + i * 4;
        const spread = 5 - (y / towerHeight) * 3.5;
        return (
          <mesh
            key={`beam-${i}`}
            position={[0, y, 0]}
            rotation={[0, (i * Math.PI) / 4, 0]}
          >
            <boxGeometry args={[spread * 2, 0.2, 0.2]} />
            <meshStandardMaterial color={red} metalness={0.4} roughness={0.5} />
          </mesh>
        );
      })}

      {/* Red aircraft warning light at top */}
      <pointLight
        position={[0, towerHeight * 1.04, 0]}
        color="#ff2200"
        intensity={5}
        distance={100}
        decay={2}
      />
      <mesh position={[0, towerHeight * 1.04, 0]}>
        <sphereGeometry args={[0.3, 8, 8]} />
        <meshBasicMaterial color="#ff2200" />
      </mesh>
    </group>
  );
};

// Pagodas — Japanese multi-tiered towers
export const Pagodas = () => {
  const { configuration } = useTrackContext();
  const pagodaLandmarks = useMemo(
    () =>
      configuration.objectPositions.landmarks.filter(
        (l) => l.type === "pagoda",
      ),
    [configuration.objectPositions.landmarks],
  );

  const pagodas = useMemo(
    () =>
      pagodaLandmarks.map((landmark) => ({
        pos: landmark.position,
        rot: landmark.rotation ?? 0,
        name: (landmark.properties?.name as string) ?? "塔",
        tiers: (landmark.properties?.tiers as number) ?? 5,
        color: (landmark.properties?.color as string) ?? "#8b2020",
        accent: (landmark.properties?.accent as string) ?? "#c8a050",
      })),
    [pagodaLandmarks],
  );

  if (pagodas.length === 0) return null;

  return (
    <group>
      {pagodas.map((pagoda, i) => {
        const tierHeight = 5;
        const baseWidth = 10;

        return (
          <group
            key={`pagoda-${i}`}
            position={[pagoda.pos[0], 0, pagoda.pos[2]]}
            rotation={[0, pagoda.rot, 0]}
          >
            {/* Stone base platform */}
            <mesh position={[0, 0.5, 0]}>
              <boxGeometry args={[baseWidth + 4, 1, baseWidth + 4]} />
              <meshStandardMaterial color="#777777" roughness={0.9} />
            </mesh>

            {/* Tiers */}
            {Array.from({ length: pagoda.tiers }).map((_, tier) => {
              const tierScale = 1 - tier * 0.15;
              const tierW = baseWidth * tierScale;
              const yBase = 1 + tier * tierHeight;

              return (
                <group key={`tier-${tier}`}>
                  {/* Tier body (walls) */}
                  <mesh position={[0, yBase + tierHeight * 0.35, 0]}>
                    <boxGeometry
                      args={[tierW * 0.85, tierHeight * 0.7, tierW * 0.85]}
                    />
                    <meshStandardMaterial
                      color={pagoda.color}
                      roughness={0.8}
                    />
                  </mesh>

                  {/* Curved roof overhang */}
                  <mesh position={[0, yBase + tierHeight * 0.75, 0]}>
                    <boxGeometry args={[tierW * 1.2, 0.3, tierW * 1.2]} />
                    <meshStandardMaterial
                      color={pagoda.accent}
                      metalness={0.3}
                      roughness={0.5}
                    />
                  </mesh>

                  {/* Roof edge trim */}
                  <mesh position={[0, yBase + tierHeight * 0.82, 0]}>
                    <boxGeometry args={[tierW * 1.1, 0.15, tierW * 1.1]} />
                    <meshStandardMaterial
                      color={pagoda.color}
                      roughness={0.7}
                    />
                  </mesh>

                  {/* Window openings (front) */}
                  {Array.from({
                    length: Math.max(1, Math.floor(tierW / 3)),
                  }).map((_, w) => {
                    const windowCount = Math.max(1, Math.floor(tierW / 3));
                    const spacing = (tierW * 0.7) / windowCount;
                    const startX = -((windowCount - 1) * spacing) / 2;
                    return (
                      <mesh
                        key={`win-${tier}-${w}`}
                        position={[
                          startX + w * spacing,
                          yBase + tierHeight * 0.35,
                          -tierW * 0.43,
                        ]}
                      >
                        <planeGeometry args={[1.2, 2]} />
                        <meshStandardMaterial
                          color="#1a1208"
                          emissive="#ffa040"
                          emissiveIntensity={
                            seededRandom(i * 500 + tier * 10 + w) > 0.4
                              ? 0.2
                              : 0
                          }
                          side={THREE.DoubleSide}
                        />
                      </mesh>
                    );
                  })}

                  {/* Corner pillars */}
                  {[
                    [-1, -1],
                    [1, -1],
                    [-1, 1],
                    [1, 1],
                  ].map(([cx, cz], ci) => (
                    <mesh
                      key={`pillar-${tier}-${ci}`}
                      position={[
                        cx * tierW * 0.4,
                        yBase + tierHeight * 0.35,
                        cz * tierW * 0.4,
                      ]}
                    >
                      <cylinderGeometry
                        args={[0.15, 0.2, tierHeight * 0.7, 6]}
                      />
                      <meshStandardMaterial
                        color={pagoda.accent}
                        roughness={0.6}
                      />
                    </mesh>
                  ))}
                </group>
              );
            })}

            {/* Spire on top */}
            <mesh position={[0, 1 + pagoda.tiers * tierHeight + 1.5, 0]}>
              <coneGeometry args={[0.4, 3, 6]} />
              <meshStandardMaterial
                color={pagoda.accent}
                metalness={0.5}
                roughness={0.3}
              />
            </mesh>

            {/* Name plate at base */}
            <mesh position={[0, 2.5, -(baseWidth / 2 + 2.5)]}>
              <boxGeometry args={[6, 1.8, 0.3]} />
              <meshStandardMaterial color={pagoda.accent} roughness={0.6} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
};

// Hotels — two luxury hotels placed safely away from track
export const Hotels = () => {
  const { configuration } = useTrackContext();
  const hotelLandmarks = useMemo(
    () =>
      configuration.objectPositions.landmarks.filter((l) => l.type === "hotel"),
    [configuration.objectPositions.landmarks],
  );

  const hotelTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 64;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "rgba(0,0,0,0)";
    context.clearRect(0, 0, 256, 64);
    context.fillStyle = "#ffd700";
    context.font = "bold 28px serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    return new THREE.CanvasTexture(canvas);
  }, []);

  const hotels = useMemo(
    () =>
      hotelLandmarks.map((landmark) => ({
        pos: landmark.position,
        rot: landmark.rotation ?? 0,
        name: (landmark.properties?.name as string) ?? "HOTEL",
        color: (landmark.properties?.color as string) ?? "#e8dcc8",
        accent: (landmark.properties?.accent as string) ?? "#8b6914",
      })),
    [hotelLandmarks],
  );

  return (
    <group>
      {hotels.map((hotel, i) => (
        <group
          key={`hotel-${i}`}
          position={[hotel.pos[0], 0, hotel.pos[2]]}
          rotation={[0, hotel.rot, 0]}
        >
          {/* Main tower */}
          <mesh position={[0, 18, 0]} castShadow>
            <boxGeometry args={[16, 36, 12]} />
            <meshStandardMaterial color={hotel.color} roughness={0.8} />
          </mesh>

          {/* Window grid — front */}
          {Array.from({ length: 10 }).map((_, floor) =>
            Array.from({ length: 5 }).map((_, col) => (
              <mesh
                key={`fw-${floor}-${col}`}
                position={[-5.6 + col * 2.8, 2.5 + floor * 3.4, -6.05]}
              >
                <planeGeometry args={[1.6, 2.2]} />
                <meshStandardMaterial
                  color={
                    seededRandom(i * 1000 + floor * 10 + col) > 0.4
                      ? "#8ec8e8"
                      : "#c8dce8"
                  }
                  emissive={
                    seededRandom(i * 2000 + floor * 10 + col) > 0.2
                      ? "#ffd080"
                      : "#88aacc"
                  }
                  emissiveIntensity={
                    seededRandom(i * 2000 + floor * 10 + col) > 0.2 ? 0.6 : 0.3
                  }
                  metalness={0.6}
                  roughness={0.2}
                />
              </mesh>
            )),
          )}

          {/* Window grid — back */}
          {Array.from({ length: 10 }).map((_, floor) =>
            Array.from({ length: 5 }).map((_, col) => (
              <mesh
                key={`bw-${floor}-${col}`}
                position={[-5.6 + col * 2.8, 2.5 + floor * 3.4, 6.05]}
                rotation={[0, Math.PI, 0]}
              >
                <planeGeometry args={[1.6, 2.2]} />
                <meshStandardMaterial
                  color="#8ec8e8"
                  emissive="#ffd080"
                  emissiveIntensity={0.5}
                  metalness={0.6}
                  roughness={0.2}
                />
              </mesh>
            )),
          )}

          {/* Entrance canopy */}
          <mesh position={[0, 1.5, -7.5]}>
            <boxGeometry args={[8, 0.3, 3]} />
            <meshStandardMaterial
              color={hotel.accent}
              metalness={0.3}
              roughness={0.5}
            />
          </mesh>

          {/* Entrance pillars */}
          {[-3, 3].map((px, pi) => (
            <mesh key={`pillar-${pi}`} position={[px, 0.75, -8]}>
              <cylinderGeometry args={[0.3, 0.35, 1.5, 8]} />
              <meshStandardMaterial
                color="#f0e8d0"
                metalness={0.2}
                roughness={0.6}
              />
            </mesh>
          ))}

          {/* Entrance door */}
          <mesh position={[0, 0.7, -6.08]}>
            <planeGeometry args={[3, 1.4]} />
            <meshStandardMaterial color="#3a2818" side={THREE.DoubleSide} />
          </mesh>

          {/* Roof penthouse */}
          <mesh position={[0, 37, 0]}>
            <boxGeometry args={[10, 2, 8]} />
            <meshStandardMaterial color={hotel.color} roughness={0.7} />
          </mesh>

          {/* Roof railing */}
          <mesh position={[0, 36.2, 0]}>
            <boxGeometry args={[16.5, 0.3, 12.5]} />
            <meshStandardMaterial color="#555555" roughness={0.6} />
          </mesh>

          {/* Hotel name sign */}
          <mesh position={[0, 35.5, -6.1]}>
            <planeGeometry args={[12, 1.5]} />
            <meshStandardMaterial
              color={hotel.accent}
              side={THREE.DoubleSide}
            />
          </mesh>

          {/* Side wing */}
          <mesh position={[-11, 8, 0]} castShadow>
            <boxGeometry args={[6, 16, 10]} />
            <meshStandardMaterial color={hotel.color} roughness={0.8} />
          </mesh>

          {/* Side wing windows */}
          {Array.from({ length: 4 }).map((_, floor) =>
            Array.from({ length: 3 }).map((_, col) => (
              <mesh
                key={`sw-${floor}-${col}`}
                position={[-12.5 + col * 2, 2.5 + floor * 3.5, -5.05]}
              >
                <planeGeometry args={[1.2, 2]} />
                <meshStandardMaterial
                  color="#8ec8e8"
                  metalness={0.6}
                  roughness={0.2}
                />
              </mesh>
            )),
          )}

          {/* Terraces — balconies on every other floor, front side */}
          {Array.from({ length: 5 }).map((_, tf) => (
            <group key={`terrace-${tf}`}>
              {/* Balcony slab */}
              <mesh position={[0, 3.4 + tf * 6.8, -6.6]}>
                <boxGeometry args={[14, 0.15, 1.2]} />
                <meshStandardMaterial color="#e0d8c8" roughness={0.7} />
              </mesh>
              {/* Railing — front bar */}
              <mesh position={[0, 3.9 + tf * 6.8, -7.15]}>
                <boxGeometry args={[14, 0.06, 0.06]} />
                <meshStandardMaterial
                  color="#888888"
                  metalness={0.7}
                  roughness={0.3}
                />
              </mesh>
              {/* Railing — vertical bars */}
              {Array.from({ length: 8 }).map((_, rb) => (
                <mesh
                  key={`rb-${rb}`}
                  position={[-5.5 + rb * 1.6, 3.65 + tf * 6.8, -7.15]}
                >
                  <boxGeometry args={[0.04, 0.55, 0.04]} />
                  <meshStandardMaterial
                    color="#888888"
                    metalness={0.7}
                    roughness={0.3}
                  />
                </mesh>
              ))}
              {/* Railing — bottom bar */}
              <mesh position={[0, 3.45 + tf * 6.8, -7.15]}>
                <boxGeometry args={[14, 0.04, 0.04]} />
                <meshStandardMaterial
                  color="#888888"
                  metalness={0.7}
                  roughness={0.3}
                />
              </mesh>
            </group>
          ))}

          {/* Side wing terrace (roof) */}
          <mesh position={[-11, 16.1, 0]}>
            <boxGeometry args={[7, 0.15, 11]} />
            <meshStandardMaterial color="#c8c0b0" roughness={0.6} />
          </mesh>
          {/* Terrace railing on side wing roof */}
          {[
            [-14.5, 0],
            [-7.5, 0],
            [-11, -5.5],
            [-11, 5.5],
          ].map(([rx, rz], ri) => (
            <mesh key={`swrail-${ri}`} position={[rx, 16.5, rz]}>
              <boxGeometry
                args={[ri < 2 ? 0.06 : 7, 0.8, ri < 2 ? 11 : 0.06]}
              />
              <meshStandardMaterial
                color="#888888"
                metalness={0.6}
                roughness={0.3}
                transparent
                opacity={0.5}
              />
            </mesh>
          ))}
          {/* Lounge chairs on side wing terrace */}
          {[-13, -11, -9].map((cx, ci) => (
            <group key={`chair-${ci}`} position={[cx, 16.25, -2 + ci * 0.3]}>
              <mesh>
                <boxGeometry args={[0.8, 0.12, 2]} />
                <meshStandardMaterial color="#f5f5f5" roughness={0.6} />
              </mesh>
              <mesh position={[0, 0.25, -0.8]} rotation={[0.5, 0, 0]}>
                <boxGeometry args={[0.8, 0.08, 0.7]} />
                <meshStandardMaterial color="#f5f5f5" roughness={0.6} />
              </mesh>
            </group>
          ))}
          {/* Terrace umbrella */}
          <mesh position={[-11, 18, 2]}>
            <cylinderGeometry args={[0.05, 0.05, 2, 4]} />
            <meshStandardMaterial color="#888888" metalness={0.5} />
          </mesh>
          <mesh position={[-11, 19, 2]}>
            <coneGeometry args={[1.8, 0.5, 8]} />
            <meshStandardMaterial
              color={i === 0 ? "#cc3333" : "#2255aa"}
              roughness={0.7}
            />
          </mesh>

          {/* Swimming pool area */}
          <group position={[12, 0, i === 0 ? 0 : -2]}>
            {/* Pool surround (deck) */}
            <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[12, 8]} />
              <meshStandardMaterial color="#d4c8a8" roughness={0.6} />
            </mesh>
            {/* Pool water */}
            <mesh position={[0, 0.06, 0]}>
              <boxGeometry args={[9, 0.12, 5]} />
              <meshStandardMaterial
                color="#3aaae6"
                metalness={0.5}
                roughness={0.05}
                transparent
                opacity={0.85}
              />
            </mesh>
            {/* Pool edge tiles */}
            <mesh position={[0, 0.13, 0]}>
              <boxGeometry args={[9.4, 0.04, 5.4]} />
              <meshStandardMaterial color="#e8e0d0" roughness={0.5} />
            </mesh>
            {/* Pool inner walls (darker water edges) */}
            <mesh position={[0, 0.01, 0]}>
              <boxGeometry args={[9, 0.02, 5]} />
              <meshStandardMaterial color="#1a6a9a" roughness={0.2} />
            </mesh>
            {/* Pool side lounge chairs */}
            {[-3, 0, 3].map((lx, li) => (
              <mesh key={`poolchair-${li}`} position={[lx, 0.15, 3.8]}>
                <boxGeometry args={[1.2, 0.1, 2.2]} />
                <meshStandardMaterial color="#f0f0f0" roughness={0.5} />
              </mesh>
            ))}
            {/* Pool umbrellas */}
            {[-3, 3].map((ux, ui) => (
              <group key={`pumbrella-${ui}`} position={[ux, 0, 3.8]}>
                <mesh position={[0, 1.2, 0]}>
                  <cylinderGeometry args={[0.04, 0.04, 2.2, 4]} />
                  <meshStandardMaterial color="#777" metalness={0.5} />
                </mesh>
                <mesh position={[0, 2.3, 0]}>
                  <coneGeometry args={[1.4, 0.4, 8]} />
                  <meshStandardMaterial
                    color={ui === 0 ? "#e8e0d0" : "#2266aa"}
                    roughness={0.7}
                  />
                </mesh>
              </group>
            ))}
          </group>
        </group>
      ))}
    </group>
  );
};

// Notre-Dame style gothic cathedral — gray stone with stained glass
export const Cathedral = () => {
  const { configuration } = useTrackContext();
  const cathedralLandmark = useMemo(
    () =>
      configuration.objectPositions.landmarks.find(
        (l) => l.type === "cathedral",
      ),
    [configuration.objectPositions.landmarks],
  );
  const cathedralPosition = cathedralLandmark?.position ?? [0, 0, 0];
  const cathedralRotation = cathedralLandmark?.rotation ?? 0.5;

  const stone = "#8a8a88";
  const darkStone = "#6a6a68";
  const lightStone = "#a0a09e";

  // Stained glass textures
  const roseWindowTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext("2d")!;
    const cx = 128,
      cy = 128,
      radius = 120;
    // Dark background
    context.fillStyle = "#1a1a2a";
    context.fillRect(0, 0, 256, 256);
    // Radial colored segments
    const colors = [
      "#c62828",
      "#1565c0",
      "#2e7d32",
      "#f9a825",
      "#6a1b9a",
      "#00838f",
      "#d84315",
      "#1565c0",
    ];
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const nextAngle = ((i + 1) / 12) * Math.PI * 2;
      context.beginPath();
      context.moveTo(cx, cy);
      context.arc(cx, cy, radius, angle, nextAngle);
      context.closePath();
      context.fillStyle = colors[i % colors.length];
      context.globalAlpha = 0.7;
      context.fill();
      context.globalAlpha = 1;
    }
    // Inner ring
    context.beginPath();
    context.arc(cx, cy, radius * 0.5, 0, Math.PI * 2);
    context.fillStyle = "#1a1a2a";
    context.fill();
    // Inner colored petals
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + 0.2;
      const nextAngle = ((i + 1) / 8) * Math.PI * 2 + 0.2;
      context.beginPath();
      context.moveTo(cx, cy);
      context.arc(cx, cy, radius * 0.48, angle, nextAngle);
      context.closePath();
      context.fillStyle = colors[(i + 3) % colors.length];
      context.globalAlpha = 0.75;
      context.fill();
      context.globalAlpha = 1;
    }
    // Center circle
    context.beginPath();
    context.arc(cx, cy, radius * 0.15, 0, Math.PI * 2);
    context.fillStyle = "#f9a825";
    context.globalAlpha = 0.8;
    context.fill();
    context.globalAlpha = 1;
    // Stone frame lines
    context.strokeStyle = "#6a6a68";
    context.lineWidth = 3;
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      context.beginPath();
      context.moveTo(cx, cy);
      context.lineTo(
        cx + Math.cos(angle) * radius,
        cy + Math.sin(angle) * radius,
      );
      context.stroke();
    }
    context.beginPath();
    context.arc(cx, cy, radius, 0, Math.PI * 2);
    context.stroke();
    context.beginPath();
    context.arc(cx, cy, radius * 0.5, 0, Math.PI * 2);
    context.stroke();
    return new THREE.CanvasTexture(canvas);
  }, []);

  const stainedGlassTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 128;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#1a1a2a";
    context.fillRect(0, 0, 64, 128);
    const colors = [
      "#c62828",
      "#1565c0",
      "#2e7d32",
      "#f9a825",
      "#6a1b9a",
      "#d84315",
    ];
    // Vertical stained glass panels
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 2; col++) {
        const color = colors[(row * 2 + col) % colors.length];
        context.fillStyle = color;
        context.globalAlpha = 0.65;
        context.fillRect(4 + col * 30, 8 + row * 24, 26, 20);
        context.globalAlpha = 1;
      }
    }
    // Lead lines
    context.strokeStyle = "#4a4a48";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(32, 0);
    context.lineTo(32, 128);
    context.stroke();
    for (let row = 0; row <= 5; row++) {
      context.beginPath();
      context.moveTo(0, 6 + row * 24);
      context.lineTo(64, 6 + row * 24);
      context.stroke();
    }
    // Pointed arch at top
    context.beginPath();
    context.arc(32, 8, 28, Math.PI, 0);
    context.fillStyle = "#f9a825";
    context.globalAlpha = 0.5;
    context.fill();
    context.globalAlpha = 1;
    return new THREE.CanvasTexture(canvas);
  }, []);

  if (!cathedralLandmark) return null;

  return (
    <group position={cathedralPosition} rotation={[0, cathedralRotation, 0]}>
      {/* Main nave */}
      <mesh position={[0, 12, 0]} castShadow>
        <boxGeometry args={[18, 24, 40]} />
        <meshStandardMaterial color={stone} roughness={0.95} />
      </mesh>

      {/* Front facade — taller */}
      <mesh position={[0, 16, -21]} castShadow>
        <boxGeometry args={[22, 32, 2]} />
        <meshStandardMaterial color={darkStone} roughness={0.9} />
      </mesh>

      {/* Horizontal decorative bands on facade */}
      {[6, 14, 28].map((fy, fi) => (
        <mesh key={`band-${fi}`} position={[0, fy, -22.05]}>
          <boxGeometry args={[22.2, 0.4, 0.1]} />
          <meshStandardMaterial color={lightStone} roughness={0.85} />
        </mesh>
      ))}

      {/* Gallery of kings (row of small arches) */}
      {Array.from({ length: 9 }).map((_, ki) => (
        <mesh key={`king-${ki}`} position={[-8.8 + ki * 2.2, 15, -22.1]}>
          <circleGeometry args={[0.7, 8, 0, Math.PI]} />
          <meshStandardMaterial color={lightStone} side={THREE.DoubleSide} />
        </mesh>
      ))}

      {/* Twin front towers */}
      {[-8.5, 8.5].map((tx, ti) => (
        <group key={`tower-${ti}`}>
          <mesh position={[tx, 22, -21]} castShadow>
            <boxGeometry args={[5, 44, 5]} />
            <meshStandardMaterial color={stone} roughness={0.95} />
          </mesh>
          {/* Gothic pointed pinnacles on tower tops */}
          {[-1.5, 0, 1.5].map((cx, ci) => (
            <mesh key={`pin-${ci}`} position={[tx + cx, 45.5, -21]}>
              <coneGeometry args={[0.4, 2, 4]} />
              <meshStandardMaterial color={darkStone} roughness={0.9} />
            </mesh>
          ))}
          {/* Tower pointed arch windows (stained glass) */}
          {[10, 18, 26, 34, 40].map((wy, wi) => (
            <group key={`tw-${wi}`}>
              <mesh position={[tx, wy, -23.55]}>
                <planeGeometry args={[1.4, 4]} />
                <meshStandardMaterial
                  map={stainedGlassTexture}
                  emissive="#ffffff"
                  emissiveIntensity={0.08}
                  side={THREE.DoubleSide}
                  transparent
                />
              </mesh>
              {/* Pointed arch frame above window */}
              <mesh position={[tx, wy + 2.3, -23.52]}>
                <circleGeometry args={[0.7, 8, 0, Math.PI]} />
                <meshStandardMaterial
                  color={lightStone}
                  side={THREE.DoubleSide}
                />
              </mesh>
            </group>
          ))}
        </group>
      ))}

      {/* Rose window (stained glass texture) */}
      <mesh position={[0, 24, -22.1]}>
        <circleGeometry args={[4, 32]} />
        <meshStandardMaterial
          map={roseWindowTexture}
          emissive="#ffffff"
          emissiveIntensity={0.12}
          side={THREE.DoubleSide}
          transparent
        />
      </mesh>
      {/* Rose window stone frame ring */}
      <mesh position={[0, 24, -22.15]}>
        <torusGeometry args={[4.3, 0.35, 8, 32]} />
        <meshStandardMaterial color={darkStone} roughness={0.9} />
      </mesh>

      {/* Main entrance portal (3 pointed arched doors) */}
      {[-5.5, 0, 5.5].map((dx, di) => (
        <group key={`portal-${di}`}>
          {/* Recessed arch layers (depth) */}
          {[0, 0.15, 0.3].map((depth, li) => (
            <mesh key={`arch-${li}`} position={[dx, 4, -22.1 + depth]}>
              <planeGeometry args={[3.8 - li * 0.6, 8 - li * 0.5]} />
              <meshStandardMaterial
                color={li === 2 ? "#1a1a1a" : darkStone}
                side={THREE.DoubleSide}
              />
            </mesh>
          ))}
          {/* Pointed arch top */}
          <mesh position={[dx, 8.5, -22.1]}>
            <circleGeometry args={[1.9, 16, 0, Math.PI]} />
            <meshStandardMaterial color={darkStone} side={THREE.DoubleSide} />
          </mesh>
          {/* Tympanum (decorated arch fill) */}
          <mesh position={[dx, 8.2, -22.05]}>
            <circleGeometry args={[1.5, 12, 0, Math.PI]} />
            <meshStandardMaterial color={lightStone} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}

      {/* Central spire */}
      <mesh position={[0, 42, -5]} castShadow>
        <coneGeometry args={[1.8, 24, 8]} />
        <meshStandardMaterial
          color={darkStone}
          metalness={0.2}
          roughness={0.8}
        />
      </mesh>
      {/* Spire base */}
      <mesh position={[0, 30, -5]}>
        <boxGeometry args={[5, 2.5, 5]} />
        <meshStandardMaterial color={stone} roughness={0.9} />
      </mesh>
      {/* Spire cross */}
      <mesh position={[0, 54.5, -5]}>
        <boxGeometry args={[0.15, 1.5, 0.15]} />
        <meshStandardMaterial color="#c0c0c0" metalness={0.8} />
      </mesh>
      <mesh position={[0, 54.8, -5]}>
        <boxGeometry args={[1, 0.15, 0.15]} />
        <meshStandardMaterial color="#c0c0c0" metalness={0.8} />
      </mesh>

      {/* Flying buttresses — left side */}
      {[-12, -4, 4, 12].map((bz, bi) => (
        <group key={`buttL-${bi}`}>
          {/* Buttress arm (angled) */}
          <mesh position={[-12.5, 10, bz]} rotation={[0, 0, 0.45]}>
            <boxGeometry args={[1.2, 14, 1.2]} />
            <meshStandardMaterial color={stone} roughness={0.95} />
          </mesh>
          {/* Buttress pier (vertical support) */}
          <mesh position={[-15, 5, bz]}>
            <boxGeometry args={[2, 10, 2]} />
            <meshStandardMaterial color={stone} roughness={0.95} />
          </mesh>
          {/* Pinnacle on pier */}
          <mesh position={[-15, 11.5, bz]}>
            <coneGeometry args={[0.6, 3, 4]} />
            <meshStandardMaterial color={darkStone} roughness={0.9} />
          </mesh>
        </group>
      ))}

      {/* Flying buttresses — right side */}
      {[-12, -4, 4, 12].map((bz, bi) => (
        <group key={`buttR-${bi}`}>
          <mesh position={[12.5, 10, bz]} rotation={[0, 0, -0.45]}>
            <boxGeometry args={[1.2, 14, 1.2]} />
            <meshStandardMaterial color={stone} roughness={0.95} />
          </mesh>
          <mesh position={[15, 5, bz]}>
            <boxGeometry args={[2, 10, 2]} />
            <meshStandardMaterial color={stone} roughness={0.95} />
          </mesh>
          <mesh position={[15, 11.5, bz]}>
            <coneGeometry args={[0.6, 3, 4]} />
            <meshStandardMaterial color={darkStone} roughness={0.9} />
          </mesh>
        </group>
      ))}

      {/* Side nave stained glass windows */}
      {[-14, -8, -2, 4, 10, 16].map((wz, wi) => (
        <group key={`sidewin-${wi}`}>
          {/* Left side */}
          <mesh position={[-9.05, 14, wz]}>
            <planeGeometry args={[1.8, 6]} />
            <meshStandardMaterial
              map={stainedGlassTexture}
              emissive="#ffffff"
              emissiveIntensity={0.08}
              side={THREE.DoubleSide}
              transparent
            />
          </mesh>
          <mesh position={[-9.05, 17.5, wz]}>
            <circleGeometry args={[0.9, 8, 0, Math.PI]} />
            <meshStandardMaterial
              map={stainedGlassTexture}
              emissive="#ffffff"
              emissiveIntensity={0.06}
              side={THREE.DoubleSide}
              transparent
            />
          </mesh>
          {/* Stone frame */}
          <mesh position={[-9.08, 14, wz]}>
            <planeGeometry args={[2.2, 6.5]} />
            <meshStandardMaterial color={darkStone} side={THREE.DoubleSide} />
          </mesh>
          {/* Right side */}
          <mesh position={[9.05, 14, wz]}>
            <planeGeometry args={[1.8, 6]} />
            <meshStandardMaterial
              map={stainedGlassTexture}
              emissive="#ffffff"
              emissiveIntensity={0.08}
              side={THREE.DoubleSide}
              transparent
            />
          </mesh>
          <mesh position={[9.05, 17.5, wz]}>
            <circleGeometry args={[0.9, 8, 0, Math.PI]} />
            <meshStandardMaterial
              map={stainedGlassTexture}
              emissive="#ffffff"
              emissiveIntensity={0.06}
              side={THREE.DoubleSide}
              transparent
            />
          </mesh>
          <mesh position={[9.08, 14, wz]}>
            <planeGeometry args={[2.2, 6.5]} />
            <meshStandardMaterial color={darkStone} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}

      {/* Roof ridge */}
      <mesh position={[0, 24.5, 0]} rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[13, 13, 38]} />
        <meshStandardMaterial color="#4a4a4a" roughness={0.85} />
      </mesh>
      <mesh position={[0, 28, 0]}>
        <boxGeometry args={[14, 4, 40]} />
        <meshStandardMaterial color="#4a4a4a" roughness={0.85} />
      </mesh>

      {/* Apse (rear rounded end) */}
      <mesh position={[0, 10, 20]}>
        <cylinderGeometry args={[9, 9, 20, 8, 1, false, 0, Math.PI]} />
        <meshStandardMaterial color={stone} roughness={0.95} />
      </mesh>
    </group>
  );
};

// Equestrian statue (horse with rider)
export const EquestrianStatue = () => {
  const { configuration } = useTrackContext();
  const statueLandmark = useMemo(
    () =>
      configuration.objectPositions.landmarks.find(
        (l) => l.type === "equestrian-statue",
      ),
    [configuration.objectPositions.landmarks],
  );
  if (!statueLandmark) return null;
  const statuePosition = statueLandmark.position;
  const statueRotation = statueLandmark.rotation ?? -0.8;

  return (
    <group position={statuePosition} rotation={[0, statueRotation, 0]}>
      {/* Stone pedestal */}
      <mesh position={[0, 1.5, 0]}>
        <boxGeometry args={[5, 3, 3]} />
        <meshStandardMaterial color="#8a8070" roughness={0.9} />
      </mesh>
      {/* Pedestal top trim */}
      <mesh position={[0, 3.1, 0]}>
        <boxGeometry args={[5.4, 0.2, 3.4]} />
        <meshStandardMaterial color="#7a7060" roughness={0.85} />
      </mesh>
      {/* Pedestal base */}
      <mesh position={[0, 0.15, 0]}>
        <boxGeometry args={[6, 0.3, 4]} />
        <meshStandardMaterial color="#7a7060" roughness={0.9} />
      </mesh>

      {/* Horse body */}
      <mesh position={[0, 5.2, 0]}>
        <boxGeometry args={[1.8, 1.8, 4]} />
        <meshStandardMaterial color="#6b5b3a" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Horse neck */}
      <mesh position={[0, 6.3, -1.8]} rotation={[0.6, 0, 0]}>
        <boxGeometry args={[1, 2, 1]} />
        <meshStandardMaterial color="#6b5b3a" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Horse head */}
      <mesh position={[0, 7.5, -2.5]} rotation={[0.3, 0, 0]}>
        <boxGeometry args={[0.8, 0.8, 1.5]} />
        <meshStandardMaterial color="#6b5b3a" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Horse snout */}
      <mesh position={[0, 7.3, -3.4]}>
        <boxGeometry args={[0.5, 0.5, 0.8]} />
        <meshStandardMaterial color="#6b5b3a" metalness={0.6} roughness={0.3} />
      </mesh>

      {/* Horse legs */}
      {[
        [-0.5, 3.9, -1.2],
        [0.5, 3.9, -1.2],
        [-0.5, 3.9, 1.2],
        [0.5, 3.9, 1.2],
      ].map((pos, li) => (
        <mesh key={`leg-${li}`} position={pos as [number, number, number]}>
          <boxGeometry args={[0.35, 2, 0.35]} />
          <meshStandardMaterial
            color="#6b5b3a"
            metalness={0.6}
            roughness={0.3}
          />
        </mesh>
      ))}
      {/* Horse tail */}
      <mesh position={[0, 5.5, 2.2]} rotation={[-0.4, 0, 0]}>
        <boxGeometry args={[0.3, 1.5, 0.3]} />
        <meshStandardMaterial color="#4a3a20" metalness={0.5} roughness={0.4} />
      </mesh>

      {/* Rider torso */}
      <mesh position={[0, 6.8, 0]}>
        <boxGeometry args={[1.2, 1.6, 0.8]} />
        <meshStandardMaterial color="#6b5b3a" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Rider head */}
      <mesh position={[0, 8, 0]}>
        <sphereGeometry args={[0.45, 8, 8]} />
        <meshStandardMaterial color="#6b5b3a" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Rider hat/plume */}
      <mesh position={[0, 8.6, 0]}>
        <coneGeometry args={[0.25, 0.6, 6]} />
        <meshStandardMaterial color="#6b5b3a" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Rider right arm (holding sword up) */}
      <mesh position={[0.7, 7.8, -0.2]} rotation={[0, 0, -0.5]}>
        <boxGeometry args={[0.25, 1.4, 0.25]} />
        <meshStandardMaterial color="#6b5b3a" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Sword */}
      <mesh position={[1.2, 9, -0.2]} rotation={[0, 0, -0.3]}>
        <boxGeometry args={[0.08, 2, 0.08]} />
        <meshStandardMaterial color="#c0c0c0" metalness={0.9} roughness={0.1} />
      </mesh>
    </group>
  );
};

// European medieval castle in the distance
export const Castle = () => {
  const { configuration } = useTrackContext();
  const castleLandmark = useMemo(
    () =>
      configuration.objectPositions.landmarks.find((l) => l.type === "castle"),
    [configuration.objectPositions.landmarks],
  );
  if (!castleLandmark) return null;
  const castlePosition = castleLandmark.position;
  const castleRotation = castleLandmark.rotation ?? 0.3;

  const stoneColor = "#f0ece4";
  const darkStone = "#d8d0c4";
  const roofColor = "#4a5a6a";

  return (
    <group position={castlePosition} rotation={[0, castleRotation, 0]}>
      {/* Main keep (central tower) */}
      <mesh position={[0, 20, 0]} castShadow>
        <boxGeometry args={[20, 40, 20]} />
        <meshStandardMaterial color={stoneColor} roughness={0.95} />
      </mesh>
      {/* Keep roof */}
      <mesh position={[0, 42, 0]}>
        <coneGeometry args={[16, 12, 4]} />
        <meshStandardMaterial color={roofColor} roughness={0.8} />
      </mesh>

      {/* Corner towers */}
      {[
        [-14, -14],
        [14, -14],
        [-14, 14],
        [14, 14],
      ].map(([tx, tz], ti) => (
        <group key={`ctower-${ti}`}>
          <mesh position={[tx, 16, tz]} castShadow>
            <cylinderGeometry args={[5, 5.5, 32, 10]} />
            <meshStandardMaterial color={darkStone} roughness={0.95} />
          </mesh>
          {/* Conical roof */}
          <mesh position={[tx, 34, tz]}>
            <coneGeometry args={[6, 10, 10]} />
            <meshStandardMaterial color="#4a5a6a" roughness={0.8} />
          </mesh>
          {/* Crenellations */}
          {[0, 1, 2, 3, 4, 5].map((ci) => {
            const angle = (ci / 6) * Math.PI * 2;
            return (
              <mesh
                key={`cc-${ci}`}
                position={[
                  tx + Math.cos(angle) * 5,
                  32.5,
                  tz + Math.sin(angle) * 5,
                ]}
              >
                <boxGeometry args={[1.5, 2, 1.5]} />
                <meshStandardMaterial color={darkStone} roughness={0.9} />
              </mesh>
            );
          })}
          {/* Tower windows */}
          {[8, 16, 24].map((wy, wi) => (
            <mesh
              key={`cw-${wi}`}
              position={[tx + (ti % 2 === 0 ? -5.1 : 5.1), wy, tz]}
              rotation={[0, ti % 2 === 0 ? -Math.PI / 2 : Math.PI / 2, 0]}
            >
              <planeGeometry args={[1.2, 2.5]} />
              <meshStandardMaterial color="#2a2a2a" side={THREE.DoubleSide} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Curtain walls connecting towers */}
      {[
        { pos: [0, 8, -14] as const, size: [28, 16, 2] as const },
        { pos: [0, 8, 14] as const, size: [28, 16, 2] as const },
        { pos: [-14, 8, 0] as const, size: [2, 16, 28] as const },
        { pos: [14, 8, 0] as const, size: [2, 16, 28] as const },
      ].map((wall, wi) => (
        <mesh
          key={`wall-${wi}`}
          position={[wall.pos[0], wall.pos[1], wall.pos[2]]}
        >
          <boxGeometry args={wall.size} />
          <meshStandardMaterial color={stoneColor} roughness={0.95} />
        </mesh>
      ))}

      {/* Wall crenellations */}
      {Array.from({ length: 8 }).map((_, ci) => (
        <group key={`wcren-${ci}`}>
          <mesh position={[-12 + ci * 3.5, 16.5, -14.5]}>
            <boxGeometry args={[1.5, 1.5, 1]} />
            <meshStandardMaterial color={darkStone} roughness={0.9} />
          </mesh>
          <mesh position={[-12 + ci * 3.5, 16.5, 14.5]}>
            <boxGeometry args={[1.5, 1.5, 1]} />
            <meshStandardMaterial color={darkStone} roughness={0.9} />
          </mesh>
        </group>
      ))}

      {/* Gatehouse */}
      <mesh position={[0, 6, -15.5]}>
        <boxGeometry args={[8, 12, 3]} />
        <meshStandardMaterial color={darkStone} roughness={0.9} />
      </mesh>
      {/* Gate arch */}
      <mesh position={[0, 4, -17.1]}>
        <planeGeometry args={[4, 6]} />
        <meshStandardMaterial color="#1a1a1a" side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 7.5, -17.1]}>
        <circleGeometry args={[2, 12, 0, Math.PI]} />
        <meshStandardMaterial color="#1a1a1a" side={THREE.DoubleSide} />
      </mesh>

      {/* Flag on keep */}
      <mesh position={[0, 49, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 4, 4]} />
        <meshStandardMaterial color="#555555" metalness={0.5} />
      </mesh>
      <mesh position={[1, 50, 0]}>
        <planeGeometry args={[2.5, 1.5]} />
        <meshStandardMaterial color="#cc2222" side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
};

// Luxury yachts floating on the ocean
export const Yachts = () => {
  const { configuration } = useTrackContext();
  const yachtLandmark = useMemo(
    () =>
      configuration.objectPositions.landmarks.find(
        (l) => l.type === "yacht-cluster",
      ),
    [configuration.objectPositions.landmarks],
  );
  const yachtData = useMemo(() => {
    const yachts =
      (yachtLandmark?.properties?.yachts as
        | {
            position: [number, number, number];
            rotation: number;
            scale: number;
          }[]
        | undefined) ?? [];
    return yachts.map((y) => ({
      pos: y.position,
      rot: y.rotation,
      scale: y.scale,
    }));
  }, [yachtLandmark]);

  return (
    <group>
      {yachtData.map((yacht, i) => {
        const s = yacht.scale;
        return (
          <group
            key={`yacht-${i}`}
            position={[yacht.pos[0], yacht.pos[1], yacht.pos[2]]}
            rotation={[0, yacht.rot, 0]}
            scale={[s, s, s]}
          >
            {/* Hull — sleek elongated shape */}
            <mesh position={[0, 0.4, 0]}>
              <boxGeometry args={[3, 0.8, 12]} />
              <meshStandardMaterial
                color="#f5f5f5"
                metalness={0.3}
                roughness={0.4}
              />
            </mesh>
            {/* Hull bottom — darker keel */}
            <mesh position={[0, 0.05, 0]}>
              <boxGeometry args={[2.4, 0.3, 11]} />
              <meshStandardMaterial
                color="#1a2a3a"
                metalness={0.2}
                roughness={0.6}
              />
            </mesh>
            {/* Bow (front taper) */}
            <mesh position={[0, 0.4, 6.5]} rotation={[0.3, 0, 0]}>
              <boxGeometry args={[2, 0.6, 2]} />
              <meshStandardMaterial
                color="#f5f5f5"
                metalness={0.3}
                roughness={0.4}
              />
            </mesh>
            {/* Cabin / superstructure */}
            <mesh position={[0, 1.2, -1]}>
              <boxGeometry args={[2.4, 1.0, 5]} />
              <meshStandardMaterial
                color="#ffffff"
                metalness={0.4}
                roughness={0.3}
              />
            </mesh>
            {/* Upper deck / bridge */}
            <mesh position={[0, 2.0, -0.5]}>
              <boxGeometry args={[2.0, 0.6, 3]} />
              <meshStandardMaterial
                color="#f0f0f0"
                metalness={0.4}
                roughness={0.3}
              />
            </mesh>
            {/* Windshield — tinted glass */}
            <mesh position={[0, 2.0, 1.1]}>
              <boxGeometry args={[1.8, 0.5, 0.05]} />
              <meshStandardMaterial
                color="#1a3a5c"
                metalness={0.8}
                roughness={0.1}
                transparent
                opacity={0.6}
              />
            </mesh>
            {/* Cabin windows — side port */}
            <mesh position={[1.25, 1.2, -1]}>
              <boxGeometry args={[0.05, 0.4, 3.5]} />
              <meshStandardMaterial
                color="#4a90b8"
                metalness={0.7}
                roughness={0.15}
                transparent
                opacity={0.5}
              />
            </mesh>
            {/* Cabin windows — side starboard */}
            <mesh position={[-1.25, 1.2, -1]}>
              <boxGeometry args={[0.05, 0.4, 3.5]} />
              <meshStandardMaterial
                color="#4a90b8"
                metalness={0.7}
                roughness={0.15}
                transparent
                opacity={0.5}
              />
            </mesh>
            {/* Radar mast */}
            <mesh position={[0, 2.8, -0.5]}>
              <cylinderGeometry args={[0.04, 0.04, 1.2, 6]} />
              <meshStandardMaterial color="#cccccc" metalness={0.6} />
            </mesh>
            {/* Radar dome */}
            <mesh position={[0, 3.5, -0.5]}>
              <sphereGeometry args={[0.15, 8, 6]} />
              <meshStandardMaterial color="#eeeeee" metalness={0.5} />
            </mesh>
            {/* Deck accent stripe (blue waterline) */}
            <mesh position={[0, 0.25, 0]}>
              <boxGeometry args={[3.05, 0.12, 12.05]} />
              <meshStandardMaterial color="#1e3a5f" roughness={0.5} />
            </mesh>
            {/* Stern platform */}
            <mesh position={[0, 0.5, -5.8]}>
              <boxGeometry args={[2.8, 0.15, 1.2]} />
              <meshStandardMaterial
                color="#8B6914"
                roughness={0.8}
                metalness={0.1}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
};
