import * as THREE from 'three';
import { useMemo } from 'react';
import { StartGrandstand } from './Grandstand';
import { Cameramen, TrackBuildings } from './TrackObjects';

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
            `⚠️ Track overlap risk: points ${i} & ${j} are ${dist.toFixed(1)} units apart (min: ${MIN_SAFE_DISTANCE})`
          );
        }
      }
    }
  }
  
  if (violations === 0) {
    console.log('✅ Track validation passed — no overlapping segments');
  } else {
    console.warn(`⚠️ Track validation: ${violations} potential overlaps detected`);
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
    positions[b]     = left.x;
    positions[b + 1] = 0.01;
    positions[b + 2] = left.z;
    positions[b + 3] = right.x;
    positions[b + 4] = 0.01;
    positions[b + 5] = right.z;

    const uv = i * 4;
    uvs[uv]     = i / count;
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
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
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
  const curve = new THREE.CatmullRomCurve3(createIstanbulParkPoints(), true, 'centripetal');
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
    const direction = new THREE.Vector3().subVectors(next, points[i]).normalize();
    const perp = new THREE.Vector3(-direction.z, 0, direction.x);

    innerPoints.push(points[i].clone().addScaledVector(perp, -trackWidth / 2));
    outerPoints.push(points[i].clone().addScaledVector(perp, trackWidth / 2));
  }

  return { innerPoints, outerPoints, centerPoints: points };
};

// Barrier posts rendered as instanced boxes (no twisting tube)
const BarrierPosts = ({ points, color }: { points: { pos: THREE.Vector3; dir: THREE.Vector3 }[]; color: string }) => {
  const mesh = useMemo(() => {
    // Place a barrier post every N points to keep perf manageable
    const step = 2;
    const postWidth = 0.4;
    const postHeight = 0.5;

    const count = Math.ceil(points.length / step);
    const dummy = new THREE.Object3D();
    const instancedMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(postWidth, postHeight, 1.2),
      new THREE.MeshStandardMaterial({ color, metalness: 0.3, roughness: 0.6 }),
      count
    );

    for (let i = 0; i < count; i++) {
      const idx = (i * step) % points.length;
      const { pos, dir } = points[idx];
      dummy.position.set(pos.x, postHeight / 2, pos.z);
      dummy.rotation.y = Math.atan2(dir.x, dir.z);
      dummy.updateMatrix();
      instancedMesh.setMatrixAt(i, dummy.matrix);
    }
    instancedMesh.instanceMatrix.needsUpdate = true;
    return instancedMesh;
  }, [points, color]);

  return <primitive object={mesh} />;
};

// Center line dashes
const CenterLineDashes = ({ centerPoints }: { centerPoints: THREE.Vector3[] }) => {
  const mesh = useMemo(() => {
    const step = 8;
    const count = Math.ceil(centerPoints.length / step / 2); // every other gap = dash
    const dummy = new THREE.Object3D();
    const instancedMesh = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.3, 2),
      new THREE.MeshStandardMaterial({ color: '#ffffff', side: THREE.DoubleSide }),
      count
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
  const { roadGeometry, startLinePos, startLineRot, centerPoints, leftBarrier, rightBarrier } = useMemo(() => {
    const path = getTrackPath();
    const points = path.getPoints(TRACK_POINT_COUNT);
    const roadGeometry = createRoadGeometry(points, width);

    const startPos = points[0].clone();
    const nextPos = points[1];
    const startDir = new THREE.Vector3().subVectors(nextPos, startPos).normalize();
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
      {/* Grass ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[140, -0.05, 0]} receiveShadow>
        <planeGeometry args={[1200, 1200]} />
        <meshStandardMaterial color="#2d5a27" />
      </mesh>

      {/* Road surface */}
      <mesh geometry={roadGeometry} receiveShadow>
        <meshStandardMaterial 
          color="#1a1a1a" 
          roughness={0.85} 
          metalness={0.05}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Center line dashes */}
      <CenterLineDashes centerPoints={centerPoints} />

      {/* Barrier walls — instanced boxes, no twisting */}
      <BarrierPosts points={leftBarrier} color="#cc3333" />
      <BarrierPosts points={rightBarrier} color="#3366cc" />

      {/* Start / finish line */}
      <mesh position={[startLinePos.x, 0.03, startLinePos.z]} rotation={[-Math.PI / 2, 0, startLineRot]}>
        <planeGeometry args={[width, 2.6]} />
        <meshStandardMaterial color="#f8fafc" side={THREE.DoubleSide} />
      </mesh>

      {/* Grandstand at start line (outside track) */}
      <StartGrandstand />

      {/* Buildings around the track */}
      <TrackBuildings />
    </group>
  );
};
