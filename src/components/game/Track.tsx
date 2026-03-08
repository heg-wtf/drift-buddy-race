import * as THREE from 'three';
import { useMemo } from 'react';

const TRACK_POINT_COUNT = 600;

// Lusail Qatar International Circuit — re-traced with wide spacing
// Simple non-crossing circuit with interesting turns
// One single loop — guaranteed no overlaps
const createLusailPoints = () => {
  const pts: [number, number][] = [
    // Start/finish straight (bottom, left→right)
    [-30, -70],
    [0, -70],
    [30, -70],
    // Turn 1 — sweeping right
    [55, -64],
    [68, -50],
    [74, -32],
    // Right straight (going up)
    [76, -10],
    [74, 12],
    // Turn 2 — top-right, heading left
    [66, 30],
    [52, 42],
    // Top section — S-curve going left
    [34, 46],
    [16, 42],
    [0, 50],
    [-18, 56],
    [-36, 50],
    [-50, 42],
    // Turn 3 — top-left
    [-62, 28],
    [-66, 10],
    // Left straight (going down)
    [-64, -10],
    [-58, -28],
    // Turn 4 — bottom-left chicane
    [-48, -42],
    [-56, -54],
    [-50, -64],
    // Final straight back to start
    [-40, -70],
  ];

  return pts.map(([x, z]) => new THREE.Vector3(x, 0, z));
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

export const getTrackPath = () => {
  return new THREE.CatmullRomCurve3(createLusailPoints(), true, 'catmullrom', 0.3);
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
        <planeGeometry args={[400, 400]} />
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
