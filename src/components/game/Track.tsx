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

const TRACK_POINT_COUNT = 600;
const MIN_SAFE_DISTANCE = 35; // Must be > track width (20) + margin

// Istanbul Park Circuit — pre-scaled coordinates (no multiplier needed)
// All parallel sections verified 40+ units apart
const createIstanbulParkPoints = () => {
  // Istanbul Park — remapped to match the provided reference silhouette
  // Wide layout, long T1→T2 straight, pronounced left T8, broader T9–T12 top section
  const pts: [number, number][] = [
    // START/FINISH straight (heading down, +z = south)
    [40, -20],
    [40, 10],
    [40, 40],

    // T1 — gentle right
    [58, 65],
    [88, 80],

    // Bottom straight going far right (z≈85–88)
    [140, 86],
    [210, 88],
    [280, 86],
    [340, 80],

    // T2 — big hairpin at far right (U-turn, exit BELOW outbound)
    [375, 75],
    [398, 84],
    [408, 100],
    [398, 116],
    [375, 124],

    // Return left BELOW outbound (z≈126–128, 38+ units below outbound)
    [340, 128],
    [280, 130],
    [210, 128],
    [150, 124],

    // T3 — continue left, staying well south of T1 (z≈118–108)
    [100, 118],
    [60, 108],

    // T4 — curve up-left (stays south of start straight z=0–40)
    [20, 92],
    [-15, 70],

    // T5 — heading up
    [-40, 44],
    [-55, 18],

    // T6–T7 up the left side
    [-68, -10],
    [-80, -40],
    [-90, -68],

    // T8 — multi-apex left sweeper
    [-102, -95],
    [-118, -120],
    [-112, -148],
    [-92, -162],

    // T9 — hairpin at top-left
    [-62, -170],
    [-35, -164],

    // T10 heading right across top
    [-8, -150],
    [18, -140],

    // T11 — kink
    [42, -134],
    [62, -130],

    // T12 — sharp right heading down
    [80, -126],
    [86, -110],
    [76, -92],

    // T13 — smooth curve back to start
    [62, -68],
    [48, -45],
  ];

  return pts.map(([x, z]) => new THREE.Vector3(x, 0, z));
};

// Validate track: check no non-adjacent segments are closer than MIN_SAFE_DISTANCE
const validateTrack = (curve: THREE.CatmullRomCurve3, samples: number) => {
  const points = curve.getPoints(samples);
  const minIndexGap = Math.floor(samples * 0.08); // ~8% of track apart = "non-adjacent"
  let violations = 0;

  for (let i = 0; i < points.length; i++) {
    for (let j = i + minIndexGap; j < points.length; j++) {
      // Skip points near the seam (start≈end for closed curve)
      if (j > points.length - minIndexGap && i < minIndexGap) continue;

      const dx = points[i].x - points[j].x;
      const dz = points[i].z - points[j].z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < MIN_SAFE_DISTANCE) {
        violations++;
        if (violations <= 5) {
          console.warn(
            `⚠️ Track overlap risk: points ${i} & ${j} are ${dist.toFixed(1)} units apart (min: ${MIN_SAFE_DISTANCE})`,
          );
        }
      }
    }
  }

  if (violations === 0) {
    console.log("✅ Track validation passed — no overlapping segments");
  } else {
    console.warn(
      `⚠️ Track validation: ${violations} potential overlaps detected`,
    );
  }
};

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

let _trackValidated = false;
export const getTrackPath = () => {
  const curve = new THREE.CatmullRomCurve3(
    createIstanbulParkPoints(),
    true,
    "centripetal",
  );
  if (!_trackValidated) {
    _trackValidated = true;
    // Validation disabled for performance — enable to debug overlaps
    // setTimeout(() => validateTrack(curve, TRACK_POINT_COUNT), 500);
  }
  return curve;
};

export const getTrackBounds = (trackWidth: number = 10) => {
  const curve = getTrackPath();
  const points = curve.getPoints(TRACK_POINT_COUNT);

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

interface TrackProps {
  width?: number;
}

export const Track = ({ width = 10 }: TrackProps) => {
  const {
    roadGeometry,
    startLinePos,
    startLineRot,
    centerPoints,
    leftBarrier,
    rightBarrier,
  } = useMemo(() => {
    const path = getTrackPath();
    const points = path.getPoints(TRACK_POINT_COUNT);
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
  }, [width]);

  return (
    <group>
      {/* Ocean — deep layer */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[140, -0.35, 0]}>
        <planeGeometry args={[4000, 4000]} />
        <meshStandardMaterial color="#0e2b48" metalness={0.2} roughness={0.3} />
      </mesh>
      {/* Ocean — mid layer */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[140, -0.3, 0]}>
        <planeGeometry args={[2000, 2000]} />
        <meshStandardMaterial
          color="#005286"
          metalness={0.3}
          roughness={0.25}
        />
      </mesh>
      {/* Ocean — shallow/coastal layer */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[140, -0.25, 0]}>
        <planeGeometry args={[1000, 1000]} />
        <meshStandardMaterial
          color="#65b9e3"
          transparent
          opacity={0.7}
          metalness={0.4}
          roughness={0.15}
        />
      </mesh>

      {/* Grass island (track area only) */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[140, -0.05, -20]}
        receiveShadow
      >
        <planeGeometry args={[700, 450]} />
        <meshStandardMaterial color="#2d5a27" />
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

      {/* Barrier walls — instanced boxes, no twisting */}
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

      {/* Distant mountains */}
      {[
        { pos: [-350, 0, -400], height: 120, radius: 100, color: "#5a6e4a" },
        { pos: [-200, 0, -450], height: 180, radius: 130, color: "#4d6040" },
        { pos: [-50, 0, -500], height: 150, radius: 110, color: "#556b47" },
        { pos: [200, 0, -480], height: 200, radius: 150, color: "#4a5e3d" },
        { pos: [400, 0, -420], height: 140, radius: 120, color: "#5f7350" },
        { pos: [550, 0, -380], height: 170, radius: 140, color: "#4d6040" },
        { pos: [-400, 0, 350], height: 100, radius: 90, color: "#5a6e4a" },
        { pos: [-300, 0, 450], height: 160, radius: 120, color: "#556b47" },
        { pos: [500, 0, 400], height: 130, radius: 110, color: "#4a5e3d" },
        { pos: [600, 0, 300], height: 190, radius: 140, color: "#5f7350" },
      ].map((mountain, i) => (
        <group key={`mountain-${i}`}>
          {/* Mountain body */}
          <mesh
            position={[
              mountain.pos[0],
              mountain.height / 2 - 5,
              mountain.pos[2],
            ]}
          >
            <coneGeometry args={[mountain.radius, mountain.height, 8]} />
            <meshStandardMaterial color={mountain.color} roughness={0.95} />
          </mesh>
          {/* Snow cap */}
          <mesh
            position={[
              mountain.pos[0],
              mountain.height * 0.75,
              mountain.pos[2],
            ]}
          >
            <coneGeometry
              args={[mountain.radius * 0.3, mountain.height * 0.35, 8]}
            />
            <meshStandardMaterial color="#f0f0f0" roughness={0.7} />
          </mesh>
          {/* Secondary peak */}
          <mesh
            position={[
              mountain.pos[0] + mountain.radius * 0.6,
              mountain.height * 0.3 - 5,
              mountain.pos[2] + mountain.radius * 0.3,
            ]}
          >
            <coneGeometry
              args={[mountain.radius * 0.5, mountain.height * 0.6, 7]}
            />
            <meshStandardMaterial color={mountain.color} roughness={0.95} />
          </mesh>
          {/* Snow cap on secondary peak */}
          <mesh
            position={[
              mountain.pos[0] + mountain.radius * 0.6,
              mountain.height * 0.55,
              mountain.pos[2] + mountain.radius * 0.3,
            ]}
          >
            <coneGeometry
              args={[mountain.radius * 0.15, mountain.height * 0.18, 7]}
            />
            <meshStandardMaterial color="#e8e8e8" roughness={0.7} />
          </mesh>
        </group>
      ))}

      {/* Grandstand at start line (outside track) */}
      <StartGrandstand />

      {/* Qatar Airways ground ad boards */}
      <TrackAdBoards />

      {/* DHL billboards */}
      <TrackBillboards />

      {/* AWS billboards */}
      <TrackBillboardsAWS />

      {/* Trees along the track */}
      <TrackTrees />

      {/* Buildings around the track */}
      <TrackBuildings />

      {/* Hotels */}
      <Hotels />

      {/* Notre-Dame Cathedral */}
      <Cathedral />

      {/* Equestrian statue */}
      <EquestrianStatue />

      {/* European castle in the distance */}
      <Castle />

      {/* Luxury yachts on the ocean */}
      <Yachts />
    </group>
  );
};
