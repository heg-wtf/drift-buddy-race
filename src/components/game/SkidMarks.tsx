import { useRef, useMemo, forwardRef, useImperativeHandle } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const MAX_SEGMENTS = 2000;
const FADE_DURATION = 10.0;
const SKIDMARK_Y = 0.02;
const MIN_STAMP_DISTANCE = 0.15;
const VERTICES_PER_SEGMENT = 4;
const INDICES_PER_SEGMENT = 6;

export interface SkidMarkHandle {
  addSegment: (
    wheelWorldPosition: THREE.Vector3,
    carForwardDirection: THREE.Vector3,
    intensity: number,
    carId: string,
    wheelIndex: number,
  ) => void;
}

interface SegmentMeta {
  createdAt: number;
  initialAlpha: number;
  active: boolean;
}

const _perpendicular = new THREE.Vector3();

export const SkidMarks = forwardRef<SkidMarkHandle>((_props, ref) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const nextIndex = useRef(0);
  const lastPositions = useRef(new Map<string, THREE.Vector3>());
  const segmentMeta = useRef<SegmentMeta[]>(
    Array.from({ length: MAX_SEGMENTS }, () => ({
      createdAt: 0,
      initialAlpha: 0,
      active: false,
    })),
  );

  const { positions, colors, indices } = useMemo(() => {
    const positionArray = new Float32Array(
      MAX_SEGMENTS * VERTICES_PER_SEGMENT * 3,
    );
    const colorArray = new Float32Array(
      MAX_SEGMENTS * VERTICES_PER_SEGMENT * 3,
    );
    const indexArray = new Uint32Array(MAX_SEGMENTS * INDICES_PER_SEGMENT);

    // Initialize all positions below ground (hidden)
    for (let i = 0; i < MAX_SEGMENTS * VERTICES_PER_SEGMENT; i++) {
      positionArray[i * 3 + 1] = -100;
      colorArray[i * 3] = 0.1;
      colorArray[i * 3 + 1] = 0.1;
      colorArray[i * 3 + 2] = 0.1;
    }

    // Pre-build index buffer for quad strips
    for (let i = 0; i < MAX_SEGMENTS; i++) {
      const vertexOffset = i * VERTICES_PER_SEGMENT;
      const indexOffset = i * INDICES_PER_SEGMENT;
      // Triangle 1: prev-left, prev-right, curr-left
      indexArray[indexOffset] = vertexOffset;
      indexArray[indexOffset + 1] = vertexOffset + 1;
      indexArray[indexOffset + 2] = vertexOffset + 2;
      // Triangle 2: curr-left, prev-right, curr-right
      indexArray[indexOffset + 3] = vertexOffset + 2;
      indexArray[indexOffset + 4] = vertexOffset + 1;
      indexArray[indexOffset + 5] = vertexOffset + 3;
    }

    return {
      positions: positionArray,
      colors: colorArray,
      indices: indexArray,
    };
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      addSegment(
        wheelWorldPosition: THREE.Vector3,
        carForwardDirection: THREE.Vector3,
        intensity: number,
        carId: string,
        wheelIndex: number,
      ) {
        const key = `${carId}-${wheelIndex}`;
        const lastPosition = lastPositions.current.get(key);

        if (
          lastPosition &&
          lastPosition.distanceTo(wheelWorldPosition) < MIN_STAMP_DISTANCE
        ) {
          return;
        }

        const currentPosition = wheelWorldPosition.clone();
        currentPosition.y = SKIDMARK_Y;

        if (!lastPosition) {
          lastPositions.current.set(key, currentPosition);
          return;
        }

        const halfWidth = 0.08 + intensity * 0.12;

        // Perpendicular to forward direction on the XZ plane
        _perpendicular.set(-carForwardDirection.z, 0, carForwardDirection.x);
        _perpendicular.normalize();

        const segmentIndex = nextIndex.current;
        const vertexBase = segmentIndex * VERTICES_PER_SEGMENT * 3;

        // Previous edge (2 vertices)
        positions[vertexBase] = lastPosition.x - _perpendicular.x * halfWidth;
        positions[vertexBase + 1] = SKIDMARK_Y;
        positions[vertexBase + 2] =
          lastPosition.z - _perpendicular.z * halfWidth;

        positions[vertexBase + 3] =
          lastPosition.x + _perpendicular.x * halfWidth;
        positions[vertexBase + 4] = SKIDMARK_Y;
        positions[vertexBase + 5] =
          lastPosition.z + _perpendicular.z * halfWidth;

        // Current edge (2 vertices)
        positions[vertexBase + 6] =
          currentPosition.x - _perpendicular.x * halfWidth;
        positions[vertexBase + 7] = SKIDMARK_Y;
        positions[vertexBase + 8] =
          currentPosition.z - _perpendicular.z * halfWidth;

        positions[vertexBase + 9] =
          currentPosition.x + _perpendicular.x * halfWidth;
        positions[vertexBase + 10] = SKIDMARK_Y;
        positions[vertexBase + 11] =
          currentPosition.z + _perpendicular.z * halfWidth;

        // Set color (dark rubber) with brightness encoding alpha
        const darkness = 0.05 + (1 - intensity) * 0.05;
        const colorBase = segmentIndex * VERTICES_PER_SEGMENT * 3;
        for (let v = 0; v < VERTICES_PER_SEGMENT; v++) {
          colors[colorBase + v * 3] = darkness;
          colors[colorBase + v * 3 + 1] = darkness;
          colors[colorBase + v * 3 + 2] = darkness;
        }

        // Update metadata
        segmentMeta.current[segmentIndex] = {
          createdAt: performance.now() / 1000,
          initialAlpha: intensity,
          active: true,
        };

        lastPositions.current.set(key, currentPosition);
        nextIndex.current = (nextIndex.current + 1) % MAX_SEGMENTS;

        // Mark buffers dirty
        if (meshRef.current) {
          const geometry = meshRef.current.geometry;
          geometry.attributes.position.needsUpdate = true;
          geometry.attributes.color.needsUpdate = true;
        }
      },
    }),
    [positions, colors],
  );

  // Fade old segments
  useFrame(() => {
    if (!meshRef.current) return;

    const now = performance.now() / 1000;
    let needsColorUpdate = false;

    for (let i = 0; i < MAX_SEGMENTS; i++) {
      const meta = segmentMeta.current[i];
      if (!meta.active) continue;

      const age = now - meta.createdAt;
      if (age > FADE_DURATION) {
        // Fully faded — hide segment
        meta.active = false;
        const vertexBase = i * VERTICES_PER_SEGMENT * 3;
        for (let v = 0; v < VERTICES_PER_SEGMENT; v++) {
          positions[vertexBase + v * 3 + 1] = -100;
        }
        meshRef.current.geometry.attributes.position.needsUpdate = true;
        needsColorUpdate = true;
        continue;
      }

      // Fade: blend color from dark rubber toward road color (#68655e ≈ 0.41, 0.40, 0.37)
      const fadeRatio = age / FADE_DURATION;
      const darkness = 0.05 + fadeRatio * 0.35;
      const colorBase = i * VERTICES_PER_SEGMENT * 3;
      for (let v = 0; v < VERTICES_PER_SEGMENT; v++) {
        colors[colorBase + v * 3] = darkness;
        colors[colorBase + v * 3 + 1] = darkness;
        colors[colorBase + v * 3 + 2] = darkness;
      }
      needsColorUpdate = true;
    }

    if (needsColorUpdate) {
      meshRef.current.geometry.attributes.color.needsUpdate = true;
    }
  });

  return (
    <mesh ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={MAX_SEGMENTS * VERTICES_PER_SEGMENT}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={MAX_SEGMENTS * VERTICES_PER_SEGMENT}
          array={colors}
          itemSize={3}
        />
        <bufferAttribute
          attach="index"
          count={MAX_SEGMENTS * INDICES_PER_SEGMENT}
          array={indices}
          itemSize={1}
        />
      </bufferGeometry>
      <meshBasicMaterial
        vertexColors
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-1}
        polygonOffsetUnits={-1}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
});

SkidMarks.displayName = "SkidMarks";
