import { useRef, useMemo, forwardRef, useImperativeHandle } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const MAX_SEGMENTS = 2000;
const FADE_DURATION = 10.0;
const SKIDMARK_Y = 0.02;
const MIN_STAMP_DISTANCE = 0.15;
const VERTICES_PER_SEGMENT = 4;
const INDICES_PER_SEGMENT = 6;
const NEW_TRAIL_GAP_SECONDS = 0.15;
const TAPER_SEGMENT_COUNT = 3;

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

const skidVertexShader = /* glsl */ `
  attribute float alpha;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vColor = color;
    vAlpha = alpha;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const skidFragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    gl_FragColor = vec4(vColor, vAlpha);
  }
`;

export const SkidMarks = forwardRef<SkidMarkHandle>((_props, ref) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const nextIndex = useRef(0);
  const lastPositions = useRef(new Map<string, THREE.Vector3>());
  const lastTimestamps = useRef(new Map<string, number>());
  const trailSegmentCounts = useRef(new Map<string, number>());
  const segmentMeta = useRef<SegmentMeta[]>(
    Array.from({ length: MAX_SEGMENTS }, () => ({
      createdAt: 0,
      initialAlpha: 0,
      active: false,
    })),
  );

  const { positions, colors, alphas, indices } = useMemo(() => {
    const positionArray = new Float32Array(
      MAX_SEGMENTS * VERTICES_PER_SEGMENT * 3,
    );
    const colorArray = new Float32Array(
      MAX_SEGMENTS * VERTICES_PER_SEGMENT * 3,
    );
    const alphaArray = new Float32Array(MAX_SEGMENTS * VERTICES_PER_SEGMENT);
    const indexArray = new Uint32Array(MAX_SEGMENTS * INDICES_PER_SEGMENT);

    // Initialize all positions below ground (hidden)
    for (let i = 0; i < MAX_SEGMENTS * VERTICES_PER_SEGMENT; i++) {
      positionArray[i * 3 + 1] = -100;
      colorArray[i * 3] = 0.1;
      colorArray[i * 3 + 1] = 0.1;
      colorArray[i * 3 + 2] = 0.1;
      alphaArray[i] = 0;
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
      alphas: alphaArray,
      indices: indexArray,
    };
  }, []);

  const shaderMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: skidVertexShader,
        fragmentShader: skidFragmentShader,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      }),
    [],
  );

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
        const now = performance.now() / 1000;

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
          lastTimestamps.current.set(key, now);
          trailSegmentCounts.current.set(key, 0);
          return;
        }

        // Detect new trail start (gap in time)
        const lastTime = lastTimestamps.current.get(key) ?? 0;
        if (now - lastTime > NEW_TRAIL_GAP_SECONDS) {
          trailSegmentCounts.current.set(key, 0);
        }

        const trailCount = trailSegmentCounts.current.get(key) ?? 0;

        // Start taper: first few segments grow from 30% to 100% width
        let taperFactor = 1.0;
        if (trailCount < TAPER_SEGMENT_COUNT) {
          taperFactor = 0.3 + (0.7 * trailCount) / TAPER_SEGMENT_COUNT;
        }

        // Width micro-variation (±10%)
        const randomFactor = 0.9 + Math.random() * 0.2;

        const halfWidth =
          (0.08 + intensity * 0.12) * taperFactor * randomFactor;

        // Intensity-based alpha
        const segmentAlpha = 0.3 + intensity * 0.7;

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

        // Set color: warm rubber tint instead of pure grey
        const darkness = 0.05 + (1 - intensity) * 0.05;
        const colorBase = segmentIndex * VERTICES_PER_SEGMENT * 3;
        const alphaBase = segmentIndex * VERTICES_PER_SEGMENT;
        for (let v = 0; v < VERTICES_PER_SEGMENT; v++) {
          colors[colorBase + v * 3] = darkness * 1.15;
          colors[colorBase + v * 3 + 1] = darkness * 1.05;
          colors[colorBase + v * 3 + 2] = darkness * 0.85;
          alphas[alphaBase + v] = segmentAlpha;
        }

        // Update metadata
        segmentMeta.current[segmentIndex] = {
          createdAt: now,
          initialAlpha: segmentAlpha,
          active: true,
        };

        lastPositions.current.set(key, currentPosition);
        lastTimestamps.current.set(key, now);
        trailSegmentCounts.current.set(key, trailCount + 1);
        nextIndex.current = (nextIndex.current + 1) % MAX_SEGMENTS;

        // Mark buffers dirty
        if (meshRef.current) {
          const geometry = meshRef.current.geometry;
          geometry.attributes.position.needsUpdate = true;
          geometry.attributes.color.needsUpdate = true;
          geometry.attributes.alpha.needsUpdate = true;
        }
      },
    }),
    [positions, colors, alphas],
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

      // Non-linear fade (easeOut): fast fade then slow tail
      const t = age / FADE_DURATION;
      const fadeRatio = 1 - (1 - t) * (1 - t);

      const darkness = 0.05 + fadeRatio * 0.35;
      const colorBase = i * VERTICES_PER_SEGMENT * 3;
      const alphaBase = i * VERTICES_PER_SEGMENT;
      for (let v = 0; v < VERTICES_PER_SEGMENT; v++) {
        colors[colorBase + v * 3] = darkness * 1.15;
        colors[colorBase + v * 3 + 1] = darkness * 1.05;
        colors[colorBase + v * 3 + 2] = darkness * 0.85;
        alphas[alphaBase + v] = meta.initialAlpha * (1 - fadeRatio);
      }
      needsColorUpdate = true;
    }

    if (needsColorUpdate) {
      meshRef.current.geometry.attributes.color.needsUpdate = true;
      meshRef.current.geometry.attributes.alpha.needsUpdate = true;
    }
  });

  return (
    <mesh ref={meshRef} material={shaderMaterial}>
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
          attach="attributes-alpha"
          count={MAX_SEGMENTS * VERTICES_PER_SEGMENT}
          array={alphas}
          itemSize={1}
        />
        <bufferAttribute
          attach="index"
          count={MAX_SEGMENTS * INDICES_PER_SEGMENT}
          array={indices}
          itemSize={1}
        />
      </bufferGeometry>
    </mesh>
  );
});

SkidMarks.displayName = "SkidMarks";
