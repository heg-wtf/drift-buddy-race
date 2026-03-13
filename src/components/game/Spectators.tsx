import * as THREE from "three";
import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useTrackContext } from "./tracks";
import { SPECTATOR_COLORS, SKIN_TONES } from "./Grandstand";

const TRACK_HALF_WIDTH = 10;
const TRACK_SAMPLE_COUNT = 600;
const ANIMATION_GROUPS = 6;

// Deterministic pseudo-random from seed
const seededRandom = (seed: number) => {
  const x = Math.sin(seed * 127.1 + seed * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// Check if position is safe from distant track segments
const isSafeFromDistantTrack = (
  x: number,
  z: number,
  radius: number,
  trackPoints: THREE.Vector3[],
  sourceIndex: number,
  skipRange: number,
): boolean => {
  const minimumDistanceSquared = (TRACK_HALF_WIDTH + radius + 3) ** 2;
  for (let i = 0; i < trackPoints.length; i += 3) {
    const indexDistance = Math.min(
      Math.abs(i - sourceIndex),
      trackPoints.length - Math.abs(i - sourceIndex),
    );
    if (indexDistance < skipRange) continue;
    const dx = x - trackPoints[i].x;
    const dz = z - trackPoints[i].z;
    if (dx * dx + dz * dz < minimumDistanceSquared) return false;
  }
  return true;
};

interface SpectatorData {
  bodyPosition: THREE.Vector3;
  headPosition: THREE.Vector3;
  baseRotationY: number;
  heightScale: number;
  phase: number;
}

export const TrackSpectators = () => {
  const { trackPath, configuration } = useTrackContext();
  const { grandstandConfigurations, standingClusterSeeds } =
    configuration.objectPositions;
  const bodyMeshReference = useRef<THREE.InstancedMesh>(null);
  const headMeshReference = useRef<THREE.InstancedMesh>(null);
  const legMeshReference = useRef<THREE.InstancedMesh>(null);
  const flagMeshReference = useRef<THREE.InstancedMesh>(null);
  const spectatorDataReference = useRef<SpectatorData[]>([]);
  const flagIndices = useRef<number[]>([]);
  const clockReference = useRef(0);
  const animationGroupReference = useRef(0);

  const {
    grandstandMeshes,
    standingBodyCount,
    standingHeadCount,
    standingLegCount,
    flagCount,
    grandstandStructures,
  } = useMemo(() => {
    const trackPoints = trackPath.getPoints(TRACK_SAMPLE_COUNT);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const allSpectatorData: SpectatorData[] = [];
    const allFlagIndices: number[] = [];

    // --- GRANDSTAND SPECTATORS ---
    const grandstandConfigurations: {
      position: [number, number, number];
      roofWidth: number;
      roofDepth: number;
      roofHeight: number;
      startPosition: [number, number];
      rows: number;
      seatsPerRow: number;
      rowDepth: number;
      seatWidth: number;
    }[] = [];

    let totalGrandstandSpectators = 0;
    for (const configuration of grandstandConfigurations) {
      totalGrandstandSpectators +=
        configuration.rows * configuration.seatsPerRow;
    }

    const grandstandSeatGeometry = new THREE.BoxGeometry(1.4, 0.25, 1.3);
    const grandstandSeatMaterial = new THREE.MeshStandardMaterial({
      color: "#555555",
      roughness: 0.8,
    });
    const grandstandSeatMesh = new THREE.InstancedMesh(
      grandstandSeatGeometry,
      grandstandSeatMaterial,
      totalGrandstandSpectators,
    );

    const grandstandBodyGeometry = new THREE.CylinderGeometry(
      0.22,
      0.18,
      0.9,
      6,
    );
    const grandstandBodyMaterial = new THREE.MeshStandardMaterial({
      roughness: 0.9,
    });
    const grandstandBodyMesh = new THREE.InstancedMesh(
      grandstandBodyGeometry,
      grandstandBodyMaterial,
      totalGrandstandSpectators,
    );

    const grandstandHeadGeometry = new THREE.SphereGeometry(0.16, 6, 6);
    const grandstandHeadMaterial = new THREE.MeshStandardMaterial({
      roughness: 0.7,
    });
    const grandstandHeadMesh = new THREE.InstancedMesh(
      grandstandHeadGeometry,
      grandstandHeadMaterial,
      totalGrandstandSpectators,
    );

    let grandstandIndex = 0;

    for (const configuration of grandstandConfigurations) {
      const { position, rotationY, rows, seatsPerRow } = configuration;
      const seatWidth = 1.6;
      const rowDepth = 1.8;
      const rowHeightStep = 1.1;

      const cosRotation = Math.cos(rotationY);
      const sinRotation = Math.sin(rotationY);

      for (let r = 0; r < rows; r++) {
        for (let s = 0; s < seatsPerRow; s++) {
          // Local coordinates
          const localX = r * rowDepth;
          const localZ = s * seatWidth - (seatsPerRow * seatWidth) / 2;
          const y = r * rowHeightStep + 0.12;

          // Rotate to world
          const worldX =
            position[0] + localX * cosRotation - localZ * sinRotation;
          const worldZ =
            position[2] + localX * sinRotation + localZ * cosRotation;

          // Seat
          dummy.position.set(worldX, y, worldZ);
          dummy.rotation.set(0, rotationY, 0);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          grandstandSeatMesh.setMatrixAt(grandstandIndex, dummy.matrix);

          // Body
          const heightScale = 0.7 + seededRandom(grandstandIndex * 31) * 0.5;
          const offsetX = (seededRandom(grandstandIndex * 47) - 0.5) * 0.3;
          const offsetZ = (seededRandom(grandstandIndex * 61) - 0.5) * 0.3;
          const bodyX = worldX + offsetX * cosRotation - offsetZ * sinRotation;
          const bodyZ = worldZ + offsetX * sinRotation + offsetZ * cosRotation;

          const bodyPosition = new THREE.Vector3(bodyX, y + 0.6, bodyZ);
          const baseRotation =
            rotationY +
            Math.PI +
            (seededRandom(grandstandIndex * 73) - 0.5) * 0.4;

          dummy.position.copy(bodyPosition);
          dummy.rotation.set(0, baseRotation, 0);
          dummy.scale.set(1, heightScale, 1);
          dummy.updateMatrix();
          grandstandBodyMesh.setMatrixAt(grandstandIndex, dummy.matrix);
          color.set(
            SPECTATOR_COLORS[
              Math.floor(
                seededRandom(grandstandIndex * 89) * SPECTATOR_COLORS.length,
              )
            ],
          );
          grandstandBodyMesh.setColorAt(grandstandIndex, color);

          // Head
          const headPosition = new THREE.Vector3(
            bodyX,
            y + 0.6 + 0.5 * heightScale,
            bodyZ,
          );
          dummy.position.copy(headPosition);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          grandstandHeadMesh.setMatrixAt(grandstandIndex, dummy.matrix);
          color.set(
            SKIN_TONES[
              Math.floor(
                seededRandom(grandstandIndex * 103) * SKIN_TONES.length,
              )
            ],
          );
          grandstandHeadMesh.setColorAt(grandstandIndex, color);

          allSpectatorData.push({
            bodyPosition: bodyPosition.clone(),
            headPosition: headPosition.clone(),
            baseRotationY: baseRotation,
            heightScale,
            phase: seededRandom(grandstandIndex * 137) * Math.PI * 2,
          });

          grandstandIndex++;
        }
      }

      // Store grandstand structural data
      const roofWidth = rows * rowDepth + 2;
      const roofDepth = seatsPerRow * seatWidth + 2;
      const roofHeight = rows * rowHeightStep + 1.5;

      grandstandConfigurations.push({
        position,
        roofWidth,
        roofDepth,
        roofHeight,
        startPosition: [0, -(seatsPerRow * seatWidth) / 2],
        rows,
        seatsPerRow,
        rowDepth,
        seatWidth,
      });
    }

    grandstandSeatMesh.instanceMatrix.needsUpdate = true;
    grandstandBodyMesh.instanceMatrix.needsUpdate = true;
    grandstandHeadMesh.instanceMatrix.needsUpdate = true;
    if (grandstandBodyMesh.instanceColor)
      grandstandBodyMesh.instanceColor.needsUpdate = true;
    if (grandstandHeadMesh.instanceColor)
      grandstandHeadMesh.instanceColor.needsUpdate = true;

    // --- STANDING SPECTATORS ---
    let totalStandingSpectators = 0;
    const validClusters: {
      worldX: number;
      worldZ: number;
      facingAngle: number;
      seed: number;
    }[][] = [];

    for (const cluster of standingClusterSeeds) {
      const { trackIndex, side, count } = cluster;
      const safeIndex = Math.min(trackIndex, trackPoints.length - 1);
      const current = trackPoints[safeIndex];
      const next = trackPoints[(safeIndex + 1) % trackPoints.length];
      const prev =
        trackPoints[(safeIndex - 1 + trackPoints.length) % trackPoints.length];

      const tangent = new THREE.Vector3().subVectors(next, prev).normalize();
      const perpendicular = new THREE.Vector3(-tangent.z, 0, tangent.x);
      const facingAngle = Math.atan2(
        -perpendicular.x * side,
        -perpendicular.z * side,
      );

      const clusterPositions: {
        worldX: number;
        worldZ: number;
        facingAngle: number;
        seed: number;
      }[] = [];

      for (let personIndex = 0; personIndex < count; personIndex++) {
        const spreadAlongTrack =
          (seededRandom(trackIndex * 1000 + personIndex * 17) - 0.5) * 6;
        const distanceFromTrack =
          TRACK_HALF_WIDTH +
          6 +
          seededRandom(trackIndex * 1000 + personIndex * 23) * 5;

        const positionX =
          current.x +
          perpendicular.x * distanceFromTrack * side +
          tangent.x * spreadAlongTrack;
        const positionZ =
          current.z +
          perpendicular.z * distanceFromTrack * side +
          tangent.z * spreadAlongTrack;

        if (
          isSafeFromDistantTrack(
            positionX,
            positionZ,
            1,
            trackPoints,
            safeIndex,
            60,
          )
        ) {
          clusterPositions.push({
            worldX: positionX,
            worldZ: positionZ,
            facingAngle:
              facingAngle +
              (seededRandom(trackIndex * 1000 + personIndex * 37) - 0.5) * 0.6,
            seed: trackIndex * 1000 + personIndex,
          });
        }
      }

      if (clusterPositions.length > 0) {
        validClusters.push(clusterPositions);
        totalStandingSpectators += clusterPositions.length;
      }
    }

    // Standing spectator meshes
    const standingBodyGeometry = new THREE.CylinderGeometry(0.22, 0.18, 0.9, 6);
    const standingBodyMaterial = new THREE.MeshStandardMaterial({
      roughness: 0.9,
    });
    const standingBodyMesh = new THREE.InstancedMesh(
      standingBodyGeometry,
      standingBodyMaterial,
      totalStandingSpectators,
    );

    const standingHeadGeometry = new THREE.SphereGeometry(0.16, 6, 6);
    const standingHeadMaterial = new THREE.MeshStandardMaterial({
      roughness: 0.7,
    });
    const standingHeadMesh = new THREE.InstancedMesh(
      standingHeadGeometry,
      standingHeadMaterial,
      totalStandingSpectators,
    );

    const standingLegGeometry = new THREE.CylinderGeometry(0.07, 0.07, 0.6, 4);
    const standingLegMaterial = new THREE.MeshStandardMaterial({
      color: "#2d3436",
      roughness: 0.9,
    });
    const standingLegMesh = new THREE.InstancedMesh(
      standingLegGeometry,
      standingLegMaterial,
      totalStandingSpectators * 2,
    );

    // Flags (20% of standing spectators)
    const totalFlagCount = Math.floor(totalStandingSpectators * 0.2);
    const flagGeometry = new THREE.PlaneGeometry(0.5, 0.35);
    const flagMaterial = new THREE.MeshStandardMaterial({
      color: "#ff0000",
      side: THREE.DoubleSide,
      roughness: 0.8,
    });
    const standingFlagMesh = new THREE.InstancedMesh(
      flagGeometry,
      flagMaterial,
      Math.max(totalFlagCount, 1),
    );

    const flagColors = [
      "#e63946",
      "#457b9d",
      "#f4a261",
      "#ffffff",
      "#2a9d8f",
      "#ff6b6b",
    ];
    let standingIndex = 0;
    let currentFlagIndex = 0;

    for (const clusterPositions of validClusters) {
      for (const person of clusterPositions) {
        const heightScale = 0.8 + seededRandom(person.seed * 41) * 0.4;
        const bodyY = 0.75;
        const headY = bodyY + 0.5 * heightScale;

        const bodyPosition = new THREE.Vector3(
          person.worldX,
          bodyY,
          person.worldZ,
        );
        const headPosition = new THREE.Vector3(
          person.worldX,
          headY,
          person.worldZ,
        );

        // Body
        dummy.position.copy(bodyPosition);
        dummy.rotation.set(0, person.facingAngle, 0);
        dummy.scale.set(1, heightScale, 1);
        dummy.updateMatrix();
        standingBodyMesh.setMatrixAt(standingIndex, dummy.matrix);
        color.set(
          SPECTATOR_COLORS[
            Math.floor(seededRandom(person.seed * 53) * SPECTATOR_COLORS.length)
          ],
        );
        standingBodyMesh.setColorAt(standingIndex, color);

        // Head
        dummy.position.copy(headPosition);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        standingHeadMesh.setMatrixAt(standingIndex, dummy.matrix);
        color.set(
          SKIN_TONES[
            Math.floor(seededRandom(person.seed * 67) * SKIN_TONES.length)
          ],
        );
        standingHeadMesh.setColorAt(standingIndex, color);

        // Legs
        const legSpread = 0.12;
        const cosAngle = Math.cos(person.facingAngle);
        const sinAngle = Math.sin(person.facingAngle);

        // Left leg
        dummy.position.set(
          person.worldX - sinAngle * legSpread,
          0.3,
          person.worldZ - cosAngle * legSpread,
        );
        dummy.rotation.set(0, person.facingAngle, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        standingLegMesh.setMatrixAt(standingIndex * 2, dummy.matrix);

        // Right leg
        dummy.position.set(
          person.worldX + sinAngle * legSpread,
          0.3,
          person.worldZ + cosAngle * legSpread,
        );
        dummy.updateMatrix();
        standingLegMesh.setMatrixAt(standingIndex * 2 + 1, dummy.matrix);

        // Flag for ~20% of spectators
        if (
          seededRandom(person.seed * 79) < 0.2 &&
          currentFlagIndex < totalFlagCount
        ) {
          dummy.position.set(
            person.worldX + sinAngle * 0.3,
            headY + 0.4,
            person.worldZ + cosAngle * 0.3,
          );
          dummy.rotation.set(0, person.facingAngle, 0);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          standingFlagMesh.setMatrixAt(currentFlagIndex, dummy.matrix);
          color.set(
            flagColors[
              Math.floor(seededRandom(person.seed * 97) * flagColors.length)
            ],
          );
          standingFlagMesh.setColorAt(currentFlagIndex, color);
          allFlagIndices.push(standingIndex);
          currentFlagIndex++;
        }

        allSpectatorData.push({
          bodyPosition: bodyPosition.clone(),
          headPosition: headPosition.clone(),
          baseRotationY: person.facingAngle,
          heightScale,
          phase: seededRandom(person.seed * 113) * Math.PI * 2,
        });

        standingIndex++;
      }
    }

    standingBodyMesh.instanceMatrix.needsUpdate = true;
    standingHeadMesh.instanceMatrix.needsUpdate = true;
    standingLegMesh.instanceMatrix.needsUpdate = true;
    standingFlagMesh.instanceMatrix.needsUpdate = true;
    if (standingBodyMesh.instanceColor)
      standingBodyMesh.instanceColor.needsUpdate = true;
    if (standingHeadMesh.instanceColor)
      standingHeadMesh.instanceColor.needsUpdate = true;
    if (standingFlagMesh.instanceColor)
      standingFlagMesh.instanceColor.needsUpdate = true;

    spectatorDataReference.current = allSpectatorData;
    flagIndices.current = allFlagIndices;

    return {
      grandstandMeshes: {
        seatMesh: grandstandSeatMesh,
        bodyMesh: grandstandBodyMesh,
        headMesh: grandstandHeadMesh,
        standingBodyMesh,
        standingHeadMesh,
        standingLegMesh,
        standingFlagMesh,
      },
      standingBodyCount: totalStandingSpectators,
      standingHeadCount: totalStandingSpectators,
      standingLegCount: totalStandingSpectators * 2,
      flagCount: currentFlagIndex,
      grandstandStructures: grandstandConfigurations.map(
        (configuration, index) => ({
          ...configuration,
          ...grandstandConfigurations[index],
        }),
      ),
    };
  }, [trackPath, grandstandConfigurations, standingClusterSeeds]);

  // Idle animation: subtle body sway + head bob, round-robin across groups
  useFrame((_, delta) => {
    clockReference.current += delta;
    animationGroupReference.current =
      (animationGroupReference.current + 1) % ANIMATION_GROUPS;

    const time = clockReference.current;
    const currentGroup = animationGroupReference.current;
    const allData = spectatorDataReference.current;
    const dummy = new THREE.Object3D();

    if (!bodyMeshReference.current || !headMeshReference.current) return;

    const grandstandTotal = grandstandConfigurations.reduce(
      (sum, configuration) =>
        sum + configuration.rows * configuration.seatsPerRow,
      0,
    );

    // Animate grandstand spectators (body sway only, they're seated)
    const grandstandBodyMesh = grandstandMeshes.bodyMesh;
    const grandstandHeadMesh = grandstandMeshes.headMesh;

    for (let i = currentGroup; i < grandstandTotal; i += ANIMATION_GROUPS) {
      const data = allData[i];
      if (!data) continue;

      const sway = Math.sin(time * 1.5 + data.phase) * 0.04;

      // Body sway
      dummy.position.copy(data.bodyPosition);
      dummy.rotation.set(0, data.baseRotationY + sway, 0);
      dummy.scale.set(1, data.heightScale, 1);
      dummy.updateMatrix();
      grandstandBodyMesh.setMatrixAt(i, dummy.matrix);

      // Head bob
      dummy.position.copy(data.headPosition);
      dummy.position.y += Math.sin(time * 2.0 + data.phase) * 0.015;
      dummy.rotation.set(0, data.baseRotationY + sway * 0.5, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      grandstandHeadMesh.setMatrixAt(i, dummy.matrix);
    }

    grandstandBodyMesh.instanceMatrix.needsUpdate = true;
    grandstandHeadMesh.instanceMatrix.needsUpdate = true;

    // Animate standing spectators
    const standingBodyMesh = bodyMeshReference.current;
    const standingHeadMesh = headMeshReference.current;

    for (let i = currentGroup; i < standingBodyCount; i += ANIMATION_GROUPS) {
      const dataIndex = grandstandTotal + i;
      const data = allData[dataIndex];
      if (!data) continue;

      const sway = Math.sin(time * 1.8 + data.phase) * 0.05;
      const bob = Math.sin(time * 2.5 + data.phase) * 0.02;

      // Body sway
      dummy.position.copy(data.bodyPosition);
      dummy.position.y += bob * 0.5;
      dummy.rotation.set(0, data.baseRotationY + sway, 0);
      dummy.scale.set(1, data.heightScale, 1);
      dummy.updateMatrix();
      standingBodyMesh.setMatrixAt(i, dummy.matrix);

      // Head bob
      dummy.position.copy(data.headPosition);
      dummy.position.y += bob;
      dummy.rotation.set(0, data.baseRotationY + sway * 0.7, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      standingHeadMesh.setMatrixAt(i, dummy.matrix);
    }

    standingBodyMesh.instanceMatrix.needsUpdate = true;
    standingHeadMesh.instanceMatrix.needsUpdate = true;

    // Animate flags (wave effect)
    if (flagMeshReference.current && flagCount > 0) {
      const flagMesh = flagMeshReference.current;
      for (
        let flagIndex = currentGroup;
        flagIndex < flagCount;
        flagIndex += ANIMATION_GROUPS
      ) {
        const spectatorIndex = flagIndices.current[flagIndex];
        if (spectatorIndex === undefined) continue;
        const dataIndex = grandstandTotal + spectatorIndex;
        const data = allData[dataIndex];
        if (!data) continue;

        const wave = Math.sin(time * 3.0 + data.phase) * 0.3;
        const cosAngle = Math.cos(data.baseRotationY);
        const sinAngle = Math.sin(data.baseRotationY);

        dummy.position.set(
          data.headPosition.x + sinAngle * 0.3,
          data.headPosition.y + 0.4 + Math.sin(time * 2.5 + data.phase) * 0.05,
          data.headPosition.z + cosAngle * 0.3,
        );
        dummy.rotation.set(wave * 0.3, data.baseRotationY, wave);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        flagMesh.setMatrixAt(flagIndex, dummy.matrix);
      }
      flagMesh.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      {/* Grandstand seated spectators */}
      <primitive object={grandstandMeshes.seatMesh} />
      <primitive object={grandstandMeshes.bodyMesh} />
      <primitive object={grandstandMeshes.headMesh} />

      {/* Standing spectators */}
      <primitive
        object={grandstandMeshes.standingBodyMesh}
        ref={bodyMeshReference}
      />
      <primitive
        object={grandstandMeshes.standingHeadMesh}
        ref={headMeshReference}
      />
      <primitive
        object={grandstandMeshes.standingLegMesh}
        ref={legMeshReference}
      />
      <primitive
        object={grandstandMeshes.standingFlagMesh}
        ref={flagMeshReference}
      />

      {/* Grandstand structures (roofs + pillars) */}
      {grandstandStructures.map((structure, structureIndex) => {
        const {
          position,
          rotationY,
          roofWidth,
          roofDepth,
          roofHeight,
          rows,
          rowDepth,
          seatWidth,
          seatsPerRow,
        } = structure;

        const cosRotation = Math.cos(rotationY);
        const sinRotation = Math.sin(rotationY);

        // Roof center in local coords
        const localRoofX = (rows * rowDepth) / 2;
        const localRoofZ = 0;
        const roofWorldX =
          position[0] + localRoofX * cosRotation - localRoofZ * sinRotation;
        const roofWorldZ =
          position[2] + localRoofX * sinRotation + localRoofZ * cosRotation;

        // Pillar corners in local coords
        const halfSeatsWidth = (seatsPerRow * seatWidth) / 2;
        const pillarCorners = [
          [0, -halfSeatsWidth],
          [0, halfSeatsWidth],
          [(rows - 1) * rowDepth, -halfSeatsWidth],
          [(rows - 1) * rowDepth, halfSeatsWidth],
        ];

        return (
          <group key={structureIndex}>
            {/* Roof */}
            <mesh
              position={[roofWorldX, roofHeight, roofWorldZ]}
              rotation={[0, rotationY, 0]}
            >
              <boxGeometry args={[roofWidth, 0.15, roofDepth]} />
              <meshStandardMaterial
                color="#2d3748"
                metalness={0.5}
                roughness={0.4}
              />
            </mesh>
            {/* Pillars */}
            {pillarCorners.map(([localPillarX, localPillarZ], pillarIndex) => {
              const pillarWorldX =
                position[0] +
                localPillarX * cosRotation -
                localPillarZ * sinRotation;
              const pillarWorldZ =
                position[2] +
                localPillarX * sinRotation +
                localPillarZ * cosRotation;
              return (
                <mesh
                  key={pillarIndex}
                  position={[pillarWorldX, roofHeight / 2, pillarWorldZ]}
                >
                  <cylinderGeometry args={[0.1, 0.1, roofHeight, 6]} />
                  <meshStandardMaterial color="#444444" metalness={0.3} />
                </mesh>
              );
            })}
          </group>
        );
      })}
    </group>
  );
};
