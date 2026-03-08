import * as THREE from 'three';
import { useMemo } from 'react';

const TRACK_POINT_COUNT = 360;

const createFigure8Points = (samples = TRACK_POINT_COUNT) => {
  const points: THREE.Vector3[] = [];

  for (let i = 0; i < samples; i++) {
    const t = (i / samples) * Math.PI * 2;
    // Clean figure-8 (∞) centerline
    const x = 34 * Math.sin(t);
    const z = 20 * Math.sin(2 * t);
    points.push(new THREE.Vector3(x, 0, z));
  }

  return points;
};

const createRoadGeometry = (centerPoints: THREE.Vector3[], width: number) => {
  const geometry = new THREE.BufferGeometry();
  const count = centerPoints.length;

  const positions = new Float32Array(count * 2 * 3);
  const uvs = new Float32Array(count * 2 * 2);
  const indices: number[] = [];

  for (let i = 0; i < count; i++) {
    const prev = centerPoints[(i - 1 + count) % count];
    const current = centerPoints[i];
    const next = centerPoints[(i + 1) % count];

    const tangent = new THREE.Vector3().subVectors(next, prev).normalize();
    const perpendicular = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

    const left = current.clone().add(perpendicular.clone().multiplyScalar(width / 2));
    const right = current.clone().add(perpendicular.clone().multiplyScalar(-width / 2));

    const basePos = i * 6;
    positions[basePos] = left.x;
    positions[basePos + 1] = 0.02;
    positions[basePos + 2] = left.z;
    positions[basePos + 3] = right.x;
    positions[basePos + 4] = 0.02;
    positions[basePos + 5] = right.z;

    const u = i / count;
    const baseUv = i * 4;
    uvs[baseUv] = u;
    uvs[baseUv + 1] = 0;
    uvs[baseUv + 2] = u;
    uvs[baseUv + 3] = 1;

    const ni = (i + 1) % count;
    const li = i * 2;
    const ri = i * 2 + 1;
    const lni = ni * 2;
    const rni = ni * 2 + 1;

    indices.push(li, ri, lni, ri, rni, lni);
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
};

export const getTrackPath = () => {
  const curve = new THREE.CatmullRomCurve3(createFigure8Points(), true, 'catmullrom', 0.25);
  return curve;
};

export const getTrackBounds = (trackWidth: number = 10) => {
  const curve = getTrackPath();
  const points = curve.getPoints(TRACK_POINT_COUNT);

  const innerPoints: THREE.Vector3[] = [];
  const outerPoints: THREE.Vector3[] = [];

  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const next = points[(i + 1) % points.length];

    const direction = new THREE.Vector3().subVectors(next, current).normalize();
    const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x);

    innerPoints.push(current.clone().add(perpendicular.clone().multiplyScalar(-trackWidth / 2)));
    outerPoints.push(current.clone().add(perpendicular.clone().multiplyScalar(trackWidth / 2)));
  }

  return { innerPoints, outerPoints, centerPoints: points };
};

interface TrackProps {
  width?: number;
}

export const Track = ({ width = 10 }: TrackProps) => {
  const { roadGeometry, startLinePos, startLineRot, innerCurve, outerCurve } = useMemo(() => {
    const path = getTrackPath();
    const points = path.getPoints(TRACK_POINT_COUNT);
    const roadGeometry = createRoadGeometry(points, width);

    const startPos = points[0].clone();
    const nextPos = points[1];
    const startDir = new THREE.Vector3().subVectors(nextPos, startPos).normalize();
    const rotation = Math.atan2(startDir.x, startDir.z);

    const bounds = getTrackBounds(width);
    const innerCurve = new THREE.CatmullRomCurve3(bounds.innerPoints, true, 'catmullrom', 0.25);
    const outerCurve = new THREE.CatmullRomCurve3(bounds.outerPoints, true, 'catmullrom', 0.25);

    return {
      roadGeometry,
      startLinePos: startPos,
      startLineRot: rotation,
      innerCurve,
      outerCurve,
    };
  }, [width]);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06, 0]} receiveShadow>
        <planeGeometry args={[260, 260]} />
        <meshStandardMaterial color="#2d5a27" />
      </mesh>

      <mesh geometry={roadGeometry} receiveShadow>
        <meshStandardMaterial color="#0a0a0a" roughness={0.88} metalness={0.06} />
      </mesh>

      <mesh position={[0, 0.25, 0]}>
        <tubeGeometry args={[innerCurve, TRACK_POINT_COUNT, 0.35, 8, true]} />
        <meshStandardMaterial color="#e74c3c" />
      </mesh>

      <mesh position={[0, 0.25, 0]}>
        <tubeGeometry args={[outerCurve, TRACK_POINT_COUNT, 0.35, 8, true]} />
        <meshStandardMaterial color="#3498db" />
      </mesh>

      <mesh position={[startLinePos.x, 0.03, startLinePos.z]} rotation={[-Math.PI / 2, 0, startLineRot]}>
        <planeGeometry args={[width, 2.6]} />
        <meshStandardMaterial color="#f8fafc" />
      </mesh>
    </group>
  );
};
