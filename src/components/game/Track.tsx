import * as THREE from "three";
import { useMemo } from "react";
import { StartGrandstand } from "./Grandstand";
import {
  Cameramen,
  Castle,
  Cathedral,
  EquestrianStatue,
  Hotels,
  TrackAdBoards,
  TrackBillboards,
  TrackBillboardsAWS,
  TrackBuildings,
  TrackTrees,
  Yachts,
} from "./TrackObjects";
import { useTrackContext } from "./tracks";
import type { MountainData } from "./tracks";

// Build a proper triangle-strip road mesh from center points
const createRoadGeometry = (centerPoints: THREE.Vector3[], width: number) => {
  const count = centerPoints.length;
  // 2 vertices per center point (left + right edge)
  const positions = new Float32Array(count * 2 * 3);
  const uvs = new Float32Array(count * 2 * 2);
  const indices: number[] = [];

  for (let i = 0; i < count; i++) {
    const prev = centerPoints[(i - 1 + count) % count];
    const next = centerPoints[(i + 1) % count];
    const current = centerPoints[i];

    // Tangent from neighbors for smooth normals
    const tangent = new THREE.Vector3().subVectors(next, prev).normalize();
    const perp = new THREE.Vector3(-tangent.z, 0, tangent.x);

    const left = current.clone().addScaledVector(perp, width / 2);
    const right = current.clone().addScaledVector(perp, -width / 2);

    const b = i * 6;
    positions[b] = left.x;
    positions[b + 1] = 0.01;
    positions[b + 2] = left.z;
    positions[b + 3] = right.x;
    positions[b + 4] = 0.01;
    positions[b + 5] = right.z;

    const uv = i * 4;
    uvs[uv] = i / count;
    uvs[uv + 1] = 0;
    uvs[uv + 2] = i / count;
    uvs[uv + 3] = 1;

    // Two triangles per quad
    const li = i * 2;
    const ri = i * 2 + 1;
    const lni = ((i + 1) % count) * 2;
    const rni = ((i + 1) % count) * 2 + 1;
    indices.push(li, ri, lni, ri, rni, lni);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
};

// Compute offset (barrier) positions along the track
const computeOffsetPoints = (centerPoints: THREE.Vector3[], offset: number) => {
  const count = centerPoints.length;
  const result: { pos: THREE.Vector3; dir: THREE.Vector3 }[] = [];
  for (let i = 0; i < count; i++) {
    const prev = centerPoints[(i - 1 + count) % count];
    const next = centerPoints[(i + 1) % count];
    const current = centerPoints[i];
    const tangent = new THREE.Vector3().subVectors(next, prev).normalize();
    const perp = new THREE.Vector3(-tangent.z, 0, tangent.x);
    result.push({
      pos: current.clone().addScaledVector(perp, offset),
      dir: tangent,
    });
  }
  return result;
};

// --- Parameterized track utility functions ---

export const buildTrackPath = (
  controlPoints: [number, number][],
): THREE.CatmullRomCurve3 => {
  const points = controlPoints.map(([x, z]) => new THREE.Vector3(x, 0, z));
  return new THREE.CatmullRomCurve3(points, true, "centripetal");
};

export const buildTrackBounds = (
  curve: THREE.CatmullRomCurve3,
  trackWidth: number = 10,
  sampleCount: number = 600,
) => {
  const points = curve.getPoints(sampleCount);
  const innerPoints: THREE.Vector3[] = [];
  const outerPoints: THREE.Vector3[] = [];

  for (let i = 0; i < points.length; i++) {
    const next = points[(i + 1) % points.length];
    const direction = new THREE.Vector3()
      .subVectors(next, points[i])
      .normalize();
    const perp = new THREE.Vector3(-direction.z, 0, direction.x);
    innerPoints.push(points[i].clone().addScaledVector(perp, -trackWidth / 2));
    outerPoints.push(points[i].clone().addScaledVector(perp, trackWidth / 2));
  }

  return { innerPoints, outerPoints, centerPoints: points };
};

// Smooth continuous barrier wall — extruded ribbon geometry along the curve
const BarrierWall = ({
  points,
  color,
}: {
  points: { pos: THREE.Vector3; dir: THREE.Vector3 }[];
  color: string;
}) => {
  const geometry = useMemo(() => {
    const barrierHeight = 0.5;
    const barrierThickness = 0.35;
    const count = points.length;

    // 4 vertices per point: outer-bottom, outer-top, inner-bottom, inner-top
    const positions = new Float32Array(count * 4 * 3);
    const normals = new Float32Array(count * 4 * 3);
    const indices: number[] = [];

    for (let i = 0; i < count; i++) {
      const { pos, dir } = points[i];
      // Perpendicular to tangent (thickness direction)
      const perpX = -dir.z;
      const perpZ = dir.x;

      const halfThick = barrierThickness / 2;

      // Outer bottom (vertex 0)
      const b = i * 12;
      positions[b] = pos.x + perpX * halfThick;
      positions[b + 1] = 0;
      positions[b + 2] = pos.z + perpZ * halfThick;
      // Outer top (vertex 1)
      positions[b + 3] = pos.x + perpX * halfThick;
      positions[b + 4] = barrierHeight;
      positions[b + 5] = pos.z + perpZ * halfThick;
      // Inner bottom (vertex 2)
      positions[b + 6] = pos.x - perpX * halfThick;
      positions[b + 7] = 0;
      positions[b + 8] = pos.z - perpZ * halfThick;
      // Inner top (vertex 3)
      positions[b + 9] = pos.x - perpX * halfThick;
      positions[b + 10] = barrierHeight;
      positions[b + 11] = pos.z - perpZ * halfThick;

      // Normals — outer face outward, inner face inward
      const nb = i * 12;
      normals[nb] = perpX;
      normals[nb + 1] = 0;
      normals[nb + 2] = perpZ;
      normals[nb + 3] = perpX;
      normals[nb + 4] = 0;
      normals[nb + 5] = perpZ;
      normals[nb + 6] = -perpX;
      normals[nb + 7] = 0;
      normals[nb + 8] = -perpZ;
      normals[nb + 9] = -perpX;
      normals[nb + 10] = 0;
      normals[nb + 11] = -perpZ;

      // Triangles connecting this segment to the next
      const ni = (i + 1) % count;
      const c = i * 4;
      const n = ni * 4;

      // Outer face (vertices 0,1)
      indices.push(c, c + 1, n + 1, c, n + 1, n);
      // Inner face (vertices 2,3)
      indices.push(c + 2, n + 3, c + 3, c + 2, n + 2, n + 3);
      // Top face (vertices 1,3)
      indices.push(c + 1, c + 3, n + 3, c + 1, n + 3, n + 1);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    geo.setIndex(indices);
    return geo;
  }, [points]);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        color={color}
        metalness={0.3}
        roughness={0.6}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

// Center line dashes
const CenterLineDashes = ({
  centerPoints,
}: {
  centerPoints: THREE.Vector3[];
}) => {
  const mesh = useMemo(() => {
    const step = 4;
    const count = Math.ceil(centerPoints.length / step / 2); // every other gap = dash
    const dummy = new THREE.Object3D();
    const instancedMesh = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.3, 2),
      new THREE.MeshStandardMaterial({
        color: "#ffffff",
        side: THREE.DoubleSide,
      }),
      count,
    );

    let idx = 0;
    for (let i = 0; i < centerPoints.length && idx < count; i += step * 2) {
      const p = centerPoints[i];
      const next = centerPoints[(i + 1) % centerPoints.length];
      const dir = new THREE.Vector3().subVectors(next, p).normalize();
      dummy.position.set(p.x, 0.025, p.z);
      dummy.rotation.set(-Math.PI / 2, 0, Math.atan2(dir.x, dir.z));
      dummy.updateMatrix();
      instancedMesh.setMatrixAt(idx, dummy.matrix);
      idx++;
    }
    instancedMesh.count = idx;
    instancedMesh.instanceMatrix.needsUpdate = true;
    return instancedMesh;
  }, [centerPoints]);

  return <primitive object={mesh} />;
};

// Mountain renderer — driven by config data
const Mountains = ({ mountains }: { mountains: MountainData[] }) => (
  <>
    {mountains.map((mountain, i) => (
      <group key={`mountain-${i}`}>
        <mesh
          position={[
            mountain.position[0],
            mountain.height / 2 - 5,
            mountain.position[2],
          ]}
        >
          <coneGeometry args={[mountain.radius, mountain.height, 8]} />
          <meshStandardMaterial color={mountain.color} roughness={0.95} />
        </mesh>
        <mesh
          position={[
            mountain.position[0],
            mountain.height * 0.75,
            mountain.position[2],
          ]}
        >
          <coneGeometry
            args={[mountain.radius * 0.3, mountain.height * 0.35, 8]}
          />
          <meshStandardMaterial color="#f0f0f0" roughness={0.7} />
        </mesh>
        <mesh
          position={[
            mountain.position[0] + mountain.radius * 0.6,
            mountain.height * 0.3 - 5,
            mountain.position[2] + mountain.radius * 0.3,
          ]}
        >
          <coneGeometry
            args={[mountain.radius * 0.5, mountain.height * 0.6, 7]}
          />
          <meshStandardMaterial color={mountain.color} roughness={0.95} />
        </mesh>
        <mesh
          position={[
            mountain.position[0] + mountain.radius * 0.6,
            mountain.height * 0.55,
            mountain.position[2] + mountain.radius * 0.3,
          ]}
        >
          <coneGeometry
            args={[mountain.radius * 0.15, mountain.height * 0.18, 7]}
          />
          <meshStandardMaterial color="#e8e8e8" roughness={0.7} />
        </mesh>
      </group>
    ))}
  </>
);

interface TrackProps {
  width?: number;
}

export const Track = ({ width = 10 }: TrackProps) => {
  const { configuration, trackPath } = useTrackContext();
  const { environment } = configuration;

  const {
    roadGeometry,
    startLinePos,
    startLineRot,
    centerPoints,
    leftBarrier,
    rightBarrier,
  } = useMemo(() => {
    const points = trackPath.getPoints(
      configuration.definition.samplePointCount,
    );
    const roadGeometry = createRoadGeometry(points, width);

    const startPos = points[0].clone();
    const nextPos = points[1];
    const startDir = new THREE.Vector3()
      .subVectors(nextPos, startPos)
      .normalize();
    const rotation = Math.atan2(startDir.x, startDir.z);

    const leftBarrier = computeOffsetPoints(points, width / 2 + 0.3);
    const rightBarrier = computeOffsetPoints(points, -(width / 2 + 0.3));

    return {
      roadGeometry,
      startLinePos: startPos,
      startLineRot: rotation,
      centerPoints: points,
      leftBarrier,
      rightBarrier,
    };
  }, [width, trackPath, configuration.definition.samplePointCount]);

  return (
    <group>
      {/* Ocean layers — from config */}
      {environment.oceanLayers.map((layer, i) => (
        <mesh
          key={`ocean-${i}`}
          rotation={[-Math.PI / 2, 0, 0]}
          position={layer.position}
        >
          <planeGeometry args={layer.dimensions} />
          <meshStandardMaterial
            color={layer.color}
            transparent={layer.opacity !== undefined}
            opacity={layer.opacity ?? 1}
            metalness={layer.metalness ?? 0.2}
            roughness={layer.roughness ?? 0.3}
          />
        </mesh>
      ))}

      {/* Grass island — from config */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={environment.grassIsland.position}
        receiveShadow
      >
        <planeGeometry args={environment.grassIsland.dimensions} />
        <meshStandardMaterial color={environment.grassIsland.color} />
      </mesh>

      {/* Road surface */}
      <mesh geometry={roadGeometry} receiveShadow>
        <meshStandardMaterial
          color="#68655e"
          roughness={0.85}
          metalness={0.05}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Center line dashes */}
      <CenterLineDashes centerPoints={centerPoints} />

      {/* Barrier walls */}
      <BarrierWall points={leftBarrier} color="#e6b800" />
      <BarrierWall points={rightBarrier} color="#e6b800" />

      {/* Start / finish line */}
      <mesh
        position={[startLinePos.x, 0.03, startLinePos.z]}
        rotation={[-Math.PI / 2, 0, startLineRot]}
      >
        <planeGeometry args={[width, 2.6]} />
        <meshStandardMaterial color="#f8fafc" side={THREE.DoubleSide} />
      </mesh>

      {/* Mountains — from config */}
      <Mountains mountains={environment.mountains} />

      {/* Grandstand at start line */}
      <StartGrandstand />

      {/* Track objects */}
      <TrackAdBoards />
      <TrackBillboards />
      <TrackBillboardsAWS />
      <TrackTrees />
      <TrackBuildings />
      <Hotels />
      <Cathedral />
      <EquestrianStatue />
      <Castle />
      <Yachts />
    </group>
  );
};
