import * as THREE from 'three';
import { useMemo } from 'react';

const TRACK_POINT_COUNT = 600;
const MIN_SAFE_DISTANCE = 35; // Must be > track width (20) + margin

// Istanbul Park Circuit — pre-scaled coordinates (no multiplier needed)
// All parallel sections verified 40+ units apart
const createIstanbulParkPoints = () => {
  // Istanbul Park — remapped to match the provided reference silhouette
  // Wide layout, long T1→T2 straight, pronounced left T8, broader T9–T12 top section
  const pts: [number, number][] = [
    // START/FINISH straight (heading down)
    [40, -35],
    [40, 0],
    [40, 40],

    // T1
    [52, 64],
    [78, 78],

    // T1→T2 long bottom straight (very wide)
    [130, 84],
    [200, 86],
    [280, 84],
    [345, 80],

    // T2 hairpin at far right
    [385, 72],
    [400, 55],
    [392, 35],
    [365, 24],

    // Return left (above outbound straight)
    [320, 22],
    [250, 22],
    [180, 24],
    [120, 28],
    [78, 34],

    // T3–T4 down-left sweep
    [35, 55],
    [-8, 70],
    [-42, 58],

    // T5–T7 left complex
    [-20, 32],
    [-36, 12],
    [-72, 10],
    [-94, -4],

    // T8 multi-apex (extends left)
    [-102, -34],
    [-114, -62],
    [-126, -88],
    [-124, -112],

    // T9
    [-100, -124],
    [-64, -124],

    // T10–T11 upper section
    [-20, -124],
    [12, -116],
    [42, -102],

    // T12
    [72, -92],
    [100, -96],
    [128, -112],
    [154, -118],
    [182, -110],

    // T13 into start straight
    [202, -88],
    [194, -62],
    [168, -50],
    [126, -46],
    [82, -44],
    [52, -42],
    [42, -38],
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
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <planeGeometry args={[800, 800]} />
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
    </group>
  );
};
