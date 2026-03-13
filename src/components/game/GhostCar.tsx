import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export interface GhostFrame {
  time: number;
  x: number;
  y: number;
  z: number;
  rotation: number;
}

export type GhostLapData = GhostFrame[];

const storageKey = (trackIdentifier: string) =>
  `drift-buddy-ghost-${trackIdentifier}`;

export const saveGhostLap = (
  trackIdentifier: string,
  data: GhostLapData,
): void => {
  try {
    localStorage.setItem(storageKey(trackIdentifier), JSON.stringify(data));
  } catch {
    // localStorage full or unavailable — silently skip
  }
};

export const loadGhostLap = (trackIdentifier: string): GhostLapData | null => {
  try {
    const stored = localStorage.getItem(storageKey(trackIdentifier));
    if (!stored) return null;
    return JSON.parse(stored) as GhostLapData;
  } catch {
    return null;
  }
};

// Binary search for the frame index just before the given time
const findFrameIndex = (frames: GhostFrame[], time: number): number => {
  let low = 0;
  let high = frames.length - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (frames[mid].time <= time) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return low;
};

interface GhostCarProps {
  ghostData: GhostLapData;
  lapStartTime: number;
  color?: string;
}

export const GhostCar = ({
  ghostData,
  lapStartTime,
  color = "#88ccff",
}: GhostCarProps) => {
  const groupReference = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!groupReference.current || ghostData.length < 2) return;

    const elapsed = (performance.now() - lapStartTime) / 1000;
    const totalDuration = ghostData[ghostData.length - 1].time;

    // Loop the ghost within the lap duration
    const currentTime = elapsed % totalDuration;

    const frameIndex = findFrameIndex(ghostData, currentTime);
    const nextFrameIndex = Math.min(frameIndex + 1, ghostData.length - 1);

    const currentFrame = ghostData[frameIndex];
    const nextFrame = ghostData[nextFrameIndex];

    // Interpolation factor
    const frameDelta = nextFrame.time - currentFrame.time;
    const interpolationFactor =
      frameDelta > 0 ? (currentTime - currentFrame.time) / frameDelta : 0;

    // Lerp position
    groupReference.current.position.set(
      currentFrame.x + (nextFrame.x - currentFrame.x) * interpolationFactor,
      currentFrame.y + (nextFrame.y - currentFrame.y) * interpolationFactor,
      currentFrame.z + (nextFrame.z - currentFrame.z) * interpolationFactor,
    );

    // Lerp rotation (handle wrap-around)
    let rotationDelta = nextFrame.rotation - currentFrame.rotation;
    if (rotationDelta > Math.PI) rotationDelta -= Math.PI * 2;
    if (rotationDelta < -Math.PI) rotationDelta += Math.PI * 2;
    groupReference.current.rotation.y =
      currentFrame.rotation + rotationDelta * interpolationFactor;
  });

  const ghostMaterialProps = {
    color,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    roughness: 0.3,
    metalness: 0.5,
  } as const;

  const ghostDarkMaterialProps = {
    color: "#aaddff",
    transparent: true,
    opacity: 0.25,
    depthWrite: false,
    roughness: 0.5,
    metalness: 0.3,
  } as const;

  return (
    <group ref={groupReference}>
      {/* Same scale and position as Car.tsx */}
      <group scale={[2.3, 2.3, 2.3]} position={[0, 0.12, 0]}>
        {/* Monocoque body */}
        <mesh position={[0, 0.22, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <capsuleGeometry args={[0.2, 2.4, 12, 16]} />
          <meshStandardMaterial {...ghostMaterialProps} />
        </mesh>

        {/* Upper body fairing */}
        <mesh position={[0, 0.28, -0.2]} scale={[1.0, 0.35, 1.8]}>
          <sphereGeometry args={[0.45, 16, 12]} />
          <meshStandardMaterial {...ghostMaterialProps} />
        </mesh>

        {/* Nose */}
        <mesh position={[0, 0.2, 1.5]} rotation={[Math.PI / 2, 0, 0]}>
          <capsuleGeometry args={[0.15, 0.8, 10, 12]} />
          <meshStandardMaterial {...ghostMaterialProps} />
        </mesh>

        {/* Nose tip */}
        <mesh position={[0, 0.18, 2.05]}>
          <sphereGeometry args={[0.1, 12, 8]} />
          <meshStandardMaterial {...ghostMaterialProps} />
        </mesh>

        {/* Nose undercut */}
        <mesh position={[0, 0.12, 1.6]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.22, 0.12, 0.8, 10]} />
          <meshStandardMaterial {...ghostMaterialProps} />
        </mesh>

        {/* Cockpit */}
        <mesh position={[0, 0.4, -0.25]} scale={[0.65, 0.45, 0.9]}>
          <sphereGeometry
            args={[0.42, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55]}
          />
          <meshStandardMaterial
            {...ghostDarkMaterialProps}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Cockpit rim */}
        <mesh position={[0, 0.42, -0.25]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.26, 0.025, 8, 20]} />
          <meshStandardMaterial {...ghostMaterialProps} />
        </mesh>

        {/* Halo */}
        <mesh position={[0, 0.58, -0.1]}>
          <torusGeometry args={[0.25, 0.022, 12, 20, Math.PI]} />
          <meshStandardMaterial {...ghostDarkMaterialProps} />
        </mesh>

        {/* Air intake */}
        <mesh position={[0, 0.62, -0.35]}>
          <cylinderGeometry args={[0.1, 0.14, 0.18, 12]} />
          <meshStandardMaterial {...ghostMaterialProps} />
        </mesh>

        {/* Engine cover / shark fin */}
        <mesh position={[0, 0.46, -0.85]} rotation={[0.06, 0, 0]}>
          <cylinderGeometry args={[0.06, 0.22, 0.9, 8]} />
          <meshStandardMaterial {...ghostMaterialProps} />
        </mesh>

        {/* Front wing */}
        <mesh position={[0, 0.08, 2.0]} rotation={[0.1, 0, 0]}>
          <boxGeometry args={[1.6, 0.025, 0.28]} />
          <meshStandardMaterial {...ghostMaterialProps} />
        </mesh>
        <mesh position={[0, 0.12, 1.9]} rotation={[0.25, 0, 0]}>
          <boxGeometry args={[1.5, 0.02, 0.18]} />
          <meshStandardMaterial {...ghostMaterialProps} />
        </mesh>

        {/* Front wing endplates */}
        {[-0.78, 0.78].map((x, i) => (
          <mesh key={`fw-ep-${i}`} position={[x, 0.12, 1.95]}>
            <boxGeometry args={[0.035, 0.13, 0.42]} />
            <meshStandardMaterial {...ghostDarkMaterialProps} />
          </mesh>
        ))}

        {/* Rear wing */}
        <mesh position={[0, 0.58, -1.5]} rotation={[-0.12, 0, 0]}>
          <boxGeometry args={[1.1, 0.035, 0.2]} />
          <meshStandardMaterial {...ghostMaterialProps} />
        </mesh>
        <mesh position={[0, 0.64, -1.48]} rotation={[-0.28, 0, 0]}>
          <boxGeometry args={[1.05, 0.025, 0.13]} />
          <meshStandardMaterial {...ghostMaterialProps} />
        </mesh>

        {/* Rear wing endplates */}
        {[-0.55, 0.55].map((x, i) => (
          <mesh key={`rw-ep-${i}`} position={[x, 0.52, -1.5]}>
            <boxGeometry args={[0.025, 0.28, 0.32]} />
            <meshStandardMaterial {...ghostDarkMaterialProps} />
          </mesh>
        ))}

        {/* Rear wing supports */}
        {[-0.3, 0.3].map((x, i) => (
          <mesh
            key={`rw-sup-${i}`}
            position={[x, 0.44, -1.45]}
            rotation={[0.1, 0, 0]}
          >
            <cylinderGeometry args={[0.018, 0.022, 0.22, 8]} />
            <meshStandardMaterial {...ghostDarkMaterialProps} />
          </mesh>
        ))}

        {/* Side pods */}
        {[-0.5, 0.5].map((x, i) => (
          <mesh
            key={`sidepod-${i}`}
            position={[x, 0.28, -0.1]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <capsuleGeometry args={[0.13, 1.1, 8, 12]} />
            <meshStandardMaterial {...ghostMaterialProps} />
          </mesh>
        ))}

        {/* Floor */}
        <mesh position={[0, 0.06, 0]}>
          <boxGeometry args={[1.05, 0.035, 2.8]} />
          <meshStandardMaterial {...ghostDarkMaterialProps} />
        </mesh>

        {/* Diffuser fins */}
        {[-0.3, -0.1, 0.1, 0.3].map((x, i) => (
          <mesh
            key={`diffuser-${i}`}
            position={[x, 0.1, -1.52]}
            rotation={[-0.3, 0, 0]}
          >
            <boxGeometry args={[0.025, 0.1, 0.3]} />
            <meshStandardMaterial {...ghostDarkMaterialProps} />
          </mesh>
        ))}

        {/* Wheels — same positions as Car.tsx */}
        {[
          { position: [-0.65, 0.2, 1.1] as const, radius: 0.22 },
          { position: [0.65, 0.2, 1.1] as const, radius: 0.22 },
          { position: [-0.65, 0.25, -1.0] as const, radius: 0.28 },
          { position: [0.65, 0.25, -1.0] as const, radius: 0.28 },
        ].map((wheel, i) => (
          <group key={`wheel-${i}`} position={wheel.position}>
            {/* Tire */}
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[wheel.radius, wheel.radius, 0.35, 16]} />
              <meshStandardMaterial {...ghostDarkMaterialProps} />
            </mesh>
            {/* Rim */}
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.12, 0.12, 0.36, 8]} />
              <meshStandardMaterial {...ghostMaterialProps} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
};
