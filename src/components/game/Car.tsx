import { useRef, useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useTrackContext } from "./tracks";

const SPARK_COUNT = 120;
const BOOST_TRAIL_COUNT = 150;

// Sponsor logo definitions
const SPONSORS = [
  {
    name: "Marlboro",
    background: "#ee0000",
    textColor: "#ffffff",
    font: "bold",
  },
  { name: "Chrome", background: "#4285F4", textColor: "#ffffff", font: "bold" },
  { name: "AWS", background: "#232F3E", textColor: "#FF9900", font: "bold" },
  {
    name: "Red Bull",
    background: "#1E3264",
    textColor: "#FFD700",
    font: "bold",
  },
  { name: "Shell", background: "#FFD500", textColor: "#DD1D21", font: "bold" },
  {
    name: "Pirelli",
    background: "#FFD100",
    textColor: "#000000",
    font: "bold",
  },
  { name: "DHL", background: "#FFCC00", textColor: "#D40511", font: "bold" },
  { name: "Rolex", background: "#006039", textColor: "#FFD700", font: "bold" },
  {
    name: "Monster",
    background: "#000000",
    textColor: "#95D600",
    font: "bold",
  },
  { name: "PUMA", background: "#000000", textColor: "#ffffff", font: "bold" },
];

// Pre-create sponsor textures once globally (shared across all cars)
const sponsorTextureCache = new Map<string, THREE.CanvasTexture>();
const getSponsorTexture = (sponsor: (typeof SPONSORS)[0]) => {
  if (sponsorTextureCache.has(sponsor.name))
    return sponsorTextureCache.get(sponsor.name)!;
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext("2d")!;
  context.clearRect(0, 0, 512, 128);
  context.fillStyle = "#ffffff";
  context.font = "bold 72px Arial, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(sponsor.name.toUpperCase(), 256, 64);
  const texture = new THREE.CanvasTexture(canvas);
  sponsorTextureCache.set(sponsor.name, texture);
  return texture;
};

// Generate car number texture
const numberTextureCache = new Map<string, THREE.CanvasTexture>();
const getNumberTexture = (num: number, carColor: string) => {
  const key = `${num}-${carColor}`;
  if (numberTextureCache.has(key)) return numberTextureCache.get(key)!;
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d")!;
  context.clearRect(0, 0, 128, 128);
  context.fillStyle = "#ffffff";
  context.font = "bold 96px Arial, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(String(num), 64, 68);
  const texture = new THREE.CanvasTexture(canvas);
  numberTextureCache.set(key, texture);
  return texture;
};

// Generate stripe livery texture
const stripeTextureCache = new Map<string, THREE.CanvasTexture>();
const getStripeTexture = (primaryColor: string, _accentColor: string) => {
  const key = `${primaryColor}-stripe`;
  if (stripeTextureCache.has(key)) return stripeTextureCache.get(key)!;
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 64;
  const context = canvas.getContext("2d")!;
  context.clearRect(0, 0, 512, 64);
  context.fillStyle = "#ffffff";
  context.beginPath();
  context.moveTo(0, 0);
  context.lineTo(100, 0);
  context.lineTo(60, 64);
  context.lineTo(0, 64);
  context.fill();
  context.beginPath();
  context.moveTo(400, 0);
  context.lineTo(512, 0);
  context.lineTo(512, 64);
  context.lineTo(360, 64);
  context.fill();
  context.fillRect(200, 22, 110, 20);
  const texture = new THREE.CanvasTexture(canvas);
  stripeTextureCache.set(key, texture);
  return texture;
};

// Pick sponsors deterministically based on car id
const pickSponsors = (carIdentifier: string) => {
  let hash = 0;
  for (let i = 0; i < carIdentifier.length; i++) {
    hash = (hash * 31 + carIdentifier.charCodeAt(i)) | 0;
  }
  const pick = (offset: number) =>
    SPONSORS[Math.abs(hash + offset) % SPONSORS.length];
  return {
    sideSponsor: pick(0),
    noseSponsor: pick(1),
    rearSponsor: pick(2),
    frontWingSponsor: pick(3),
    engineCoverSponsor: pick(4),
    helmetSponsor: pick(5),
  };
};

interface CarProps {
  position: [number, number, number];
  color: string;
  isPlayer?: boolean;
  controls?: {
    forward: boolean;
    backward: boolean;
    left: boolean;
    right: boolean;
    boost: boolean;
  };
  onUpdate?: (
    position: THREE.Vector3,
    rotation: number,
    speed: number,
    trackProgress: number,
  ) => void;
  onPositionUpdate?: (id: string, position: THREE.Vector3) => void;
  onSkidmarkUpdate?: (
    wheelPositions: THREE.Vector3[],
    forwardDirection: THREE.Vector3,
    skidIntensity: number,
  ) => void;
  aiIndex?: number;
  id: string;
  otherCars?: Map<string, THREE.Vector3>;
  trackWidth?: number;
  raceStarted?: boolean;
  playerProgress?: number;
}

export const Car = ({
  position,
  color,
  isPlayer = false,
  controls,
  onUpdate,
  onPositionUpdate,
  onSkidmarkUpdate,
  aiIndex = 0,
  id,
  otherCars,
  trackWidth = 10,
  raceStarted = false,
  playerProgress = 0,
}: CarProps) => {
  const carRef = useRef<THREE.Group>(null);
  const velocity = useRef(0);
  const rotation = useRef(0);
  // AI starts behind player: negative progress (will start at positions behind start line)
  const aiProgress = useRef(-0.02 - (aiIndex + 1) * 0.015);
  const aiSpeed = useRef(0.003 + Math.random() * 0.0015);
  const knockbackVelocity = useRef(new THREE.Vector3(0, 0, 0));
  const sparksRef = useRef<THREE.Points>(null);
  const sparkTime = useRef(0);
  const boostFlameRef = useRef<THREE.Group>(null);
  const boostTrailRef = useRef<THREE.Points>(null);
  const boostTime = useRef(0);
  const sparkVelocities = useRef(new Float32Array(SPARK_COUNT * 3));
  const sparkLifetimes = useRef(new Float32Array(SPARK_COUNT));
  const boostVelocities = useRef(new Float32Array(BOOST_TRAIL_COUNT * 3));
  const boostLifetimes = useRef(new Float32Array(BOOST_TRAIL_COUNT));
  const boostSpawnIndex = useRef(0);
  const wheelRefs = useRef<(THREE.Group | null)[]>([null, null, null, null]);
  const wheelRotation = useRef(0);

  const { trackPath: contextTrackPath, trackBounds: contextTrackBounds } =
    useTrackContext();
  const trackPath = useRef(contextTrackPath);
  const trackBounds = useRef(contextTrackBounds);
  const trackPointsForProgress = useRef(trackPath.current.getPoints(100));

  // Sponsor textures per car (deterministic by id)
  const sponsors = useMemo(() => {
    const {
      sideSponsor,
      noseSponsor,
      rearSponsor,
      frontWingSponsor,
      engineCoverSponsor,
      helmetSponsor,
    } = pickSponsors(id);
    return {
      side: getSponsorTexture(sideSponsor),
      nose: getSponsorTexture(noseSponsor),
      rear: getSponsorTexture(rearSponsor),
      frontWing: getSponsorTexture(frontWingSponsor),
      engineCover: getSponsorTexture(engineCoverSponsor),
      helmet: getSponsorTexture(helmetSponsor),
    };
  }, [id]);

  const carNumber = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = (hash * 31 + id.charCodeAt(i)) | 0;
    }
    return (Math.abs(hash) % 99) + 1;
  }, [id]);

  const numberTexture = useMemo(
    () => getNumberTexture(carNumber, color),
    [carNumber, color],
  );
  const stripeTexture = useMemo(
    () => getStripeTexture(color, "#ffffff"),
    [color],
  );

  useEffect(() => {
    if (carRef.current) {
      // Start behind the start line (t=0 is the line, go slightly back)
      const startT = 0.995;
      const startPoint = trackPath.current.getPointAt(startT);
      const nextPoint = trackPath.current.getPointAt((startT + 0.01) % 1);
      const startDir = new THREE.Vector3()
        .subVectors(nextPoint, startPoint)
        .normalize();
      rotation.current = Math.atan2(startDir.x, startDir.z);
      carRef.current.rotation.y = rotation.current;

      if (isPlayer) {
        // Player starts at front
        carRef.current.position.set(startPoint.x, 0, startPoint.z);
        aiProgress.current = 0;
        // Report initial position so camera can frame the car during countdown
        onUpdate?.(carRef.current.position.clone(), rotation.current, 0, 0);
      } else {
        // AI starts behind player in a grid formation
        const behindOffset = 0.98 - (aiIndex + 1) * 0.012; // Behind start line
        const startT = behindOffset < 0 ? 1 + behindOffset : behindOffset;
        const aiStartPoint = trackPath.current.getPointAt(startT);
        const aiNextPoint = trackPath.current.getPointAt((startT + 0.01) % 1);
        const aiDir = new THREE.Vector3()
          .subVectors(aiNextPoint, aiStartPoint)
          .normalize();
        const perpendicular = new THREE.Vector3(-aiDir.z, 0, aiDir.x);

        // Stagger left/right
        const lateralOffset = aiIndex % 2 === 0 ? 2 : -2;
        carRef.current.position.set(
          aiStartPoint.x + perpendicular.x * lateralOffset,
          0,
          aiStartPoint.z + perpendicular.z * lateralOffset,
        );
        aiProgress.current = startT;
        rotation.current = Math.atan2(aiDir.x, aiDir.z);
      }
    }
  }, []);

  const checkWallCollision = (
    pos: THREE.Vector3,
  ): { hit: boolean; normal: THREE.Vector3 } => {
    const { innerPoints, outerPoints, centerPoints } = trackBounds.current;

    // Find closest point on track center
    let minDist = Infinity;
    let closestIdx = 0;

    for (let i = 0; i < centerPoints.length; i++) {
      const dist = pos.distanceTo(centerPoints[i]);
      if (dist < minDist) {
        minDist = dist;
        closestIdx = i;
      }
    }

    // Check distance to inner and outer walls
    const innerDist = pos.distanceTo(innerPoints[closestIdx]);
    const outerDist = pos.distanceTo(outerPoints[closestIdx]);

    const wallThreshold = 1.5;

    if (innerDist < wallThreshold) {
      const normal = pos.clone().sub(innerPoints[closestIdx]).normalize();
      return { hit: true, normal };
    }

    if (outerDist < wallThreshold) {
      const normal = pos.clone().sub(outerPoints[closestIdx]).normalize();
      return { hit: true, normal };
    }

    // Check if car is off track
    const toInner = innerPoints[closestIdx]
      .clone()
      .sub(centerPoints[closestIdx]);
    const toOuter = outerPoints[closestIdx]
      .clone()
      .sub(centerPoints[closestIdx]);
    const toCar = pos.clone().sub(centerPoints[closestIdx]);

    const innerDir = toInner.normalize();
    const carDir = toCar.clone().normalize();

    const distFromCenter = toCar.length();
    const halfWidth = trackWidth / 2;

    if (distFromCenter > halfWidth - 0.5) {
      return { hit: true, normal: carDir.negate() };
    }

    return { hit: false, normal: new THREE.Vector3() };
  };

  const spawnSparks = () => {
    if (!sparksRef.current) return;
    const posAttr = sparksRef.current.geometry.attributes
      .position as THREE.BufferAttribute;
    const colAttr = sparksRef.current.geometry.attributes
      .color as THREE.BufferAttribute;
    for (let i = 0; i < SPARK_COUNT; i++) {
      posAttr.array[i * 3] = (Math.random() - 0.5) * 0.5;
      posAttr.array[i * 3 + 1] = 0.3 + Math.random() * 0.3;
      posAttr.array[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 6;
      const upSpeed = 2 + Math.random() * 5;
      sparkVelocities.current[i * 3] = Math.cos(angle) * speed;
      sparkVelocities.current[i * 3 + 1] = upSpeed;
      sparkVelocities.current[i * 3 + 2] = Math.sin(angle) * speed;
      sparkLifetimes.current[i] = 0.15 + Math.random() * 0.45;
      colAttr.array[i * 3] = 1.0;
      colAttr.array[i * 3 + 1] = 0.5 + Math.random() * 0.3;
      colAttr.array[i * 3 + 2] = Math.random() * 0.1;
    }
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  };

  useFrame((_, delta) => {
    if (!carRef.current) return;

    // Apply knockback
    if (knockbackVelocity.current.length() > 0.01) {
      carRef.current.position.add(
        knockbackVelocity.current.clone().multiplyScalar(delta * 60),
      );
      knockbackVelocity.current.multiplyScalar(0.85);
    }

    // Check collision with other cars
    if (otherCars) {
      otherCars.forEach((otherPos, otherId) => {
        if (otherId === id) return;

        const distance = carRef.current!.position.distanceTo(otherPos);
        if (distance < 2.5) {
          const pushDir = carRef
            .current!.position.clone()
            .sub(otherPos)
            .normalize();
          knockbackVelocity.current.add(pushDir.multiplyScalar(0.25));
          velocity.current *= 0.4;
          sparkTime.current = 0.5;
          spawnSparks();
        }
      });
    }

    // Check wall collision
    const wallCheck = checkWallCollision(carRef.current.position);
    if (wallCheck.hit) {
      knockbackVelocity.current.add(wallCheck.normal.multiplyScalar(0.2));
      velocity.current *= 0.3;
      sparkTime.current = 0.3;
      spawnSparks();
    }

    // Update spark physics
    if (sparksRef.current && sparkTime.current > 0) {
      sparkTime.current -= delta;
      sparksRef.current.visible = true;
      const sparkPosAttr = sparksRef.current.geometry.attributes
        .position as THREE.BufferAttribute;
      const sparkColAttr = sparksRef.current.geometry.attributes
        .color as THREE.BufferAttribute;
      const gravity = 12.0;
      for (let i = 0; i < SPARK_COUNT; i++) {
        if (sparkLifetimes.current[i] > 0) {
          sparkLifetimes.current[i] -= delta;
          sparkPosAttr.array[i * 3] += sparkVelocities.current[i * 3] * delta;
          sparkPosAttr.array[i * 3 + 1] +=
            sparkVelocities.current[i * 3 + 1] * delta;
          sparkPosAttr.array[i * 3 + 2] +=
            sparkVelocities.current[i * 3 + 2] * delta;
          sparkVelocities.current[i * 3 + 1] -= gravity * delta;
          sparkVelocities.current[i * 3] *= 0.98;
          sparkVelocities.current[i * 3 + 2] *= 0.98;
          const life = Math.max(0, sparkLifetimes.current[i] / 0.5);
          sparkColAttr.array[i * 3] = life;
          sparkColAttr.array[i * 3 + 1] = life * 0.67;
          sparkColAttr.array[i * 3 + 2] = 0;
        } else {
          sparkPosAttr.array[i * 3 + 1] = -100;
        }
      }
      sparkPosAttr.needsUpdate = true;
      sparkColAttr.needsUpdate = true;
    } else if (sparksRef.current) {
      sparksRef.current.visible = false;
    }

    if (!raceStarted) return;

    if (isPlayer && controls) {
      const acceleration = 1.0;
      const friction = 0.99;
      const turnSpeed = 2.8;
      const maxSpeed = controls.boost ? 1.8 : 1.18;
      const accelMultiplier = controls.boost ? 2.0 : 1;

      if (controls.forward) {
        velocity.current = Math.min(
          velocity.current + acceleration * accelMultiplier * delta,
          maxSpeed,
        );
      }
      if (controls.backward) {
        velocity.current = Math.max(
          velocity.current - acceleration * delta,
          -maxSpeed * 0.5,
        );
      }

      velocity.current *= friction;

      if (Math.abs(velocity.current) > 0.01) {
        if (controls.left) {
          rotation.current +=
            turnSpeed * delta * Math.sign(velocity.current) * 0.6;
        }
        if (controls.right) {
          rotation.current -=
            turnSpeed * delta * Math.sign(velocity.current) * 0.6;
        }
      }

      carRef.current.rotation.y = rotation.current;
      carRef.current.position.x +=
        Math.sin(rotation.current) * velocity.current;
      carRef.current.position.z +=
        Math.cos(rotation.current) * velocity.current;

      // Calculate player's track progress
      const pos = carRef.current.position;
      let minDist = Infinity;
      let closestT = 0;
      const trackPts = trackPointsForProgress.current;
      for (let i = 0; i < trackPts.length; i++) {
        const d = pos.distanceTo(trackPts[i]);
        if (d < minDist) {
          minDist = d;
          closestT = i / trackPts.length;
        }
      }

      // Skidmark detection
      if (onSkidmarkUpdate) {
        const currentSpeed = Math.abs(velocity.current);
        const maxSpeed = controls.boost ? 1.8 : 1.18;
        const isTurning = controls.left || controls.right;
        const isBraking = controls.backward && velocity.current > 0.3;

        const lateralSlip = isTurning ? currentSpeed / maxSpeed : 0;
        const skidIntensity = Math.max(
          isBraking ? Math.min(currentSpeed / maxSpeed, 1.0) * 0.8 : 0,
          lateralSlip > 0.3 ? lateralSlip : 0,
          controls.boost && currentSpeed < maxSpeed * 0.6 ? 0.7 : 0,
        );

        if (skidIntensity > 0.1) {
          const forward = new THREE.Vector3(
            Math.sin(rotation.current),
            0,
            Math.cos(rotation.current),
          );
          // Rear wheel offsets in local space (scaled by 2.3)
          const rearLeftLocal = new THREE.Vector3(-0.65 * 2.3, 0, -1.0 * 2.3);
          const rearRightLocal = new THREE.Vector3(0.65 * 2.3, 0, -1.0 * 2.3);
          rearLeftLocal.applyAxisAngle(
            new THREE.Vector3(0, 1, 0),
            rotation.current,
          );
          rearRightLocal.applyAxisAngle(
            new THREE.Vector3(0, 1, 0),
            rotation.current,
          );

          const wheelPositions = [
            carRef.current.position.clone().add(rearLeftLocal),
            carRef.current.position.clone().add(rearRightLocal),
          ];

          // Add front wheels when braking
          if (isBraking) {
            const frontLeftLocal = new THREE.Vector3(-0.65 * 2.3, 0, 1.1 * 2.3);
            const frontRightLocal = new THREE.Vector3(0.65 * 2.3, 0, 1.1 * 2.3);
            frontLeftLocal.applyAxisAngle(
              new THREE.Vector3(0, 1, 0),
              rotation.current,
            );
            frontRightLocal.applyAxisAngle(
              new THREE.Vector3(0, 1, 0),
              rotation.current,
            );
            wheelPositions.push(
              carRef.current.position.clone().add(frontLeftLocal),
              carRef.current.position.clone().add(frontRightLocal),
            );
          }

          onSkidmarkUpdate(wheelPositions, forward, skidIntensity);
        }
      }

      if (onUpdate) {
        onUpdate(
          carRef.current.position.clone(),
          rotation.current,
          Math.abs(velocity.current) * 85,
          closestT,
        );
      }
    } else {
      // AI car - follows track path
      const normalProgress =
        aiProgress.current < 0
          ? aiProgress.current + 1
          : aiProgress.current % 1;
      aiProgress.current += aiSpeed.current * delta * 60;
      if (aiProgress.current > 1) aiProgress.current -= 1;

      // Improved collision avoidance with player
      let avoidOffset = 0;
      let shouldSlowDown = false;

      if (otherCars) {
        const playerPos = otherCars.get("player");
        if (playerPos) {
          const myPos = carRef.current.position.clone();
          const distToPlayer = myPos.distanceTo(playerPos);

          if (distToPlayer < 8) {
            // Calculate direction to player
            const toPlayer = playerPos.clone().sub(myPos);
            toPlayer.y = 0;

            // Get current forward direction
            const forward = new THREE.Vector3(
              Math.sin(carRef.current.rotation.y),
              0,
              Math.cos(carRef.current.rotation.y),
            );

            // Check if player is ahead
            const dotForward = forward.dot(toPlayer.clone().normalize());

            if (dotForward > 0.3 && distToPlayer < 6) {
              // Player is ahead - steer away
              const right = new THREE.Vector3(-forward.z, 0, forward.x);
              const dotRight = right.dot(toPlayer.clone().normalize());
              avoidOffset = dotRight > 0 ? -3.5 : 3.5;
              shouldSlowDown = true;
            } else if (distToPlayer < 4) {
              // Player is close - just move away
              const right = new THREE.Vector3(-forward.z, 0, forward.x);
              const dotRight = right.dot(toPlayer.clone().normalize());
              avoidOffset = dotRight > 0 ? -2.5 : 2.5;
            }
          }
        }
      }

      // Slow down when avoiding
      if (shouldSlowDown) {
        aiProgress.current -= aiSpeed.current * delta * 40;
      }

      const progressT =
        aiProgress.current < 0
          ? aiProgress.current + 1
          : aiProgress.current % 1;
      const currentPoint = trackPath.current.getPointAt(progressT);
      const nextPoint = trackPath.current.getPointAt((progressT + 0.01) % 1);

      const direction = new THREE.Vector3()
        .subVectors(nextPoint, currentPoint)
        .normalize();
      const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x);

      carRef.current.position.x =
        currentPoint.x +
        perpendicular.x * avoidOffset +
        knockbackVelocity.current.x;
      carRef.current.position.z =
        currentPoint.z +
        perpendicular.z * avoidOffset +
        knockbackVelocity.current.z;

      carRef.current.rotation.y = Math.atan2(direction.x, direction.z);
    }

    // Rotate wheels based on speed
    const currentSpeed = isPlayer
      ? Math.abs(velocity.current)
      : aiSpeed.current * 60;
    wheelRotation.current += currentSpeed * delta * 25;
    for (const wheelGroup of wheelRefs.current) {
      if (wheelGroup) {
        wheelGroup.rotation.x = wheelRotation.current;
      }
    }

    // Update boost trail particles
    if (boostTrailRef.current) {
      const boostPosAttr = boostTrailRef.current.geometry.attributes
        .position as THREE.BufferAttribute;
      const boostColAttr = boostTrailRef.current.geometry.attributes
        .color as THREE.BufferAttribute;
      if (isPlayer && controls?.boost) {
        const spawnRate = 80;
        const toSpawn = Math.ceil(spawnRate * delta);
        for (let s = 0; s < toSpawn; s++) {
          const i = boostSpawnIndex.current;
          boostSpawnIndex.current =
            (boostSpawnIndex.current + 1) % BOOST_TRAIL_COUNT;
          const side = Math.random() > 0.5 ? -0.25 : 0.25;
          boostPosAttr.array[i * 3] = side + (Math.random() - 0.5) * 0.1;
          boostPosAttr.array[i * 3 + 1] = 0.2 + (Math.random() - 0.5) * 0.1;
          boostPosAttr.array[i * 3 + 2] = -1.8;
          boostVelocities.current[i * 3] = (Math.random() - 0.5) * 2;
          boostVelocities.current[i * 3 + 1] = Math.random() * 1.5;
          boostVelocities.current[i * 3 + 2] = -4 - Math.random() * 5;
          boostLifetimes.current[i] = 0.2 + Math.random() * 0.3;
          boostColAttr.array[i * 3] = 1.0;
          boostColAttr.array[i * 3 + 1] = 0.5 + Math.random() * 0.2;
          boostColAttr.array[i * 3 + 2] = 0.1 + Math.random() * 0.1;
        }
      }
      let hasAliveParticle = false;
      for (let i = 0; i < BOOST_TRAIL_COUNT; i++) {
        if (boostLifetimes.current[i] > 0) {
          hasAliveParticle = true;
          boostLifetimes.current[i] -= delta;
          boostPosAttr.array[i * 3] += boostVelocities.current[i * 3] * delta;
          boostPosAttr.array[i * 3 + 1] +=
            boostVelocities.current[i * 3 + 1] * delta;
          boostPosAttr.array[i * 3 + 2] +=
            boostVelocities.current[i * 3 + 2] * delta;
          boostVelocities.current[i * 3 + 1] -= 3.0 * delta;
          const life = Math.max(0, boostLifetimes.current[i] / 0.4);
          boostColAttr.array[i * 3] = life;
          boostColAttr.array[i * 3 + 1] = life * 0.55;
          boostColAttr.array[i * 3 + 2] = life * 0.15;
        } else {
          boostPosAttr.array[i * 3 + 1] = -100;
        }
      }
      boostTrailRef.current.visible =
        (isPlayer && controls?.boost) || hasAliveParticle;
      boostPosAttr.needsUpdate = true;
      boostColAttr.needsUpdate = true;
    }

    if (onPositionUpdate) {
      onPositionUpdate(id, carRef.current.position.clone());
    }
  });

  const isBoosting = isPlayer && controls?.boost;

  const sparkPositions = useMemo(() => {
    const arr = new Float32Array(SPARK_COUNT * 3);
    for (let i = 0; i < SPARK_COUNT; i++) {
      arr[i * 3 + 1] = -100;
    }
    return arr;
  }, []);

  const sparkColors = useMemo(() => {
    const arr = new Float32Array(SPARK_COUNT * 3);
    for (let i = 0; i < SPARK_COUNT; i++) {
      arr[i * 3] = 1.0;
      arr[i * 3 + 1] = 0.67;
      arr[i * 3 + 2] = 0.0;
    }
    return arr;
  }, []);

  const boostTrailPositions = useMemo(() => {
    const arr = new Float32Array(BOOST_TRAIL_COUNT * 3);
    for (let i = 0; i < BOOST_TRAIL_COUNT; i++) {
      arr[i * 3 + 1] = -100;
    }
    return arr;
  }, []);

  const boostTrailColors = useMemo(() => {
    const arr = new Float32Array(BOOST_TRAIL_COUNT * 3);
    for (let i = 0; i < BOOST_TRAIL_COUNT; i++) {
      arr[i * 3] = 1.0;
      arr[i * 3 + 1] = 0.67;
      arr[i * 3 + 2] = 0.2;
    }
    return arr;
  }, []);

  return (
    <group ref={carRef}>
      {/* Sparks on collision */}
      <points ref={sparksRef} visible={false}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={SPARK_COUNT}
            array={sparkPositions}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            count={SPARK_COUNT}
            array={sparkColors}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.05}
          transparent
          opacity={0.9}
          vertexColors
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      <group scale={[2.3, 2.3, 2.3]} position={[0, 0.12, 0]}>
        <>
          {/* F1 Race Car Body - Curved monocoque */}
          <mesh
            position={[0, 0.22, 0]}
            rotation={[Math.PI / 2, 0, 0]}
            castShadow
          >
            <capsuleGeometry args={[0.2, 2.4, 12, 16]} />
            <meshStandardMaterial
              color={color}
              metalness={0.4}
              roughness={0.35}
            />
          </mesh>
          {/* Upper body fairing - curved top profile */}
          <mesh position={[0, 0.28, -0.2]} scale={[1.0, 0.35, 1.8]} castShadow>
            <sphereGeometry args={[0.45, 16, 12]} />
            <meshStandardMaterial
              color={color}
              metalness={0.45}
              roughness={0.3}
            />
          </mesh>

          {/* Nose - smooth elongated capsule */}
          <mesh
            position={[0, 0.2, 1.5]}
            rotation={[Math.PI / 2, 0, 0]}
            castShadow
          >
            <capsuleGeometry args={[0.15, 0.8, 10, 12]} />
            <meshStandardMaterial
              color={color}
              metalness={0.4}
              roughness={0.35}
            />
          </mesh>
          {/* Nose tip - rounded sphere */}
          <mesh position={[0, 0.18, 2.05]} castShadow>
            <sphereGeometry args={[0.1, 12, 8]} />
            <meshStandardMaterial
              color={color}
              metalness={0.5}
              roughness={0.25}
            />
          </mesh>
          {/* Nose undercut - tapered cylinder */}
          <mesh position={[0, 0.12, 1.6]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.22, 0.12, 0.8, 10]} />
            <meshStandardMaterial
              color={color}
              metalness={0.35}
              roughness={0.4}
            />
          </mesh>

          {/* Cockpit opening - curved dark recess */}
          <mesh position={[0, 0.4, -0.25]} scale={[0.65, 0.45, 0.9]}>
            <sphereGeometry
              args={[0.42, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55]}
            />
            <meshStandardMaterial
              color="#080808"
              metalness={0.95}
              roughness={0.05}
              side={THREE.DoubleSide}
            />
          </mesh>
          {/* Cockpit surround rim */}
          <mesh position={[0, 0.42, -0.25]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.26, 0.025, 8, 20]} />
            <meshStandardMaterial
              color={color}
              metalness={0.5}
              roughness={0.3}
            />
          </mesh>

          {/* Halo - titanium protection */}
          <mesh position={[0, 0.58, -0.1]}>
            <torusGeometry args={[0.25, 0.022, 12, 20, Math.PI]} />
            <meshStandardMaterial
              color="#555"
              metalness={0.9}
              roughness={0.1}
            />
          </mesh>
          {/* Halo center pillar */}
          <mesh position={[0, 0.5, 0.12]} rotation={[-0.3, 0, 0]}>
            <capsuleGeometry args={[0.018, 0.18, 6, 8]} />
            <meshStandardMaterial
              color="#555"
              metalness={0.9}
              roughness={0.1}
            />
          </mesh>

          {/* Air intake above driver */}
          <mesh position={[0, 0.62, -0.35]} castShadow>
            <cylinderGeometry args={[0.1, 0.14, 0.18, 12]} />
            <meshStandardMaterial
              color={color}
              metalness={0.4}
              roughness={0.35}
            />
          </mesh>
          <mesh position={[0, 0.72, -0.35]}>
            <cylinderGeometry args={[0.07, 0.07, 0.02, 12]} />
            <meshStandardMaterial
              color="#050505"
              metalness={0.9}
              roughness={0.1}
            />
          </mesh>

          {/* Engine cover / shark fin */}
          <mesh position={[0, 0.46, -0.85]} rotation={[0.06, 0, 0]} castShadow>
            <cylinderGeometry args={[0.06, 0.22, 0.9, 8]} />
            <meshStandardMaterial
              color={color}
              metalness={0.4}
              roughness={0.35}
            />
          </mesh>
          {/* Engine cover sponsor decal */}
          <mesh
            position={[0.12, 0.5, -0.85]}
            rotation={[0, -Math.PI / 2, 0.06]}
          >
            <planeGeometry args={[0.7, 0.12]} />
            <meshBasicMaterial
              map={sponsors.engineCover}
              transparent
              alphaTest={0.3}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>

          {/* Body top stripe livery */}
          <mesh position={[0, 0.46, 0.3]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.35, 1.8]} />
            <meshBasicMaterial
              map={stripeTexture}
              transparent
              alphaTest={0.3}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>

          {/* Driver */}
          <group position={[0, 0.42, -0.25]}>
            {/* Helmet - smoother */}
            <mesh position={[0, 0.18, 0]}>
              <sphereGeometry args={[0.14, 16, 14]} />
              <meshStandardMaterial
                color={color}
                metalness={0.55}
                roughness={0.25}
              />
            </mesh>
            {/* Visor - curved */}
            <mesh
              position={[0, 0.17, 0.08]}
              rotation={[0.2, 0, 0]}
              scale={[1, 0.6, 0.5]}
            >
              <sphereGeometry
                args={[
                  0.12,
                  12,
                  8,
                  -Math.PI * 0.4,
                  Math.PI * 0.8,
                  Math.PI * 0.25,
                  Math.PI * 0.35,
                ]}
              />
              <meshStandardMaterial
                color="#111"
                metalness={0.95}
                roughness={0.05}
                side={THREE.DoubleSide}
              />
            </mesh>
            {/* Shoulders / upper body - rounded */}
            <mesh position={[0, 0.02, 0]} rotation={[0, 0, Math.PI / 2]}>
              <capsuleGeometry args={[0.06, 0.16, 6, 8]} />
              <meshStandardMaterial color="#222" roughness={0.8} />
            </mesh>
            {/* Helmet sponsor decal */}
            <mesh position={[0, 0.28, -0.08]} rotation={[-0.4, 0, 0]}>
              <planeGeometry args={[0.18, 0.06]} />
              <meshBasicMaterial
                map={sponsors.helmet}
                transparent
                alphaTest={0.3}
                depthWrite={false}
                side={THREE.DoubleSide}
              />
            </mesh>
            {/* Helmet number */}
            <mesh position={[0.14, 0.18, 0]} rotation={[0, Math.PI / 2, 0]}>
              <planeGeometry args={[0.1, 0.1]} />
              <meshBasicMaterial
                map={numberTexture}
                transparent
                alphaTest={0.3}
                depthWrite={false}
                side={THREE.DoubleSide}
              />
            </mesh>
          </group>

          {/* Front wing - multi-element */}
          <mesh position={[0, 0.08, 2.0]} rotation={[0.1, 0, 0]} castShadow>
            <boxGeometry args={[1.6, 0.025, 0.28]} />
            <meshStandardMaterial
              color={color}
              metalness={0.4}
              roughness={0.35}
            />
          </mesh>
          {/* Front wing upper flap */}
          <mesh position={[0, 0.12, 1.9]} rotation={[0.25, 0, 0]} castShadow>
            <boxGeometry args={[1.5, 0.02, 0.18]} />
            <meshStandardMaterial
              color={color}
              metalness={0.4}
              roughness={0.35}
            />
          </mesh>
          {/* Front wing sponsor decal */}
          <mesh position={[0, 0.1, 2.0]} rotation={[-Math.PI / 2 + 0.1, 0, 0]}>
            <planeGeometry args={[1.0, 0.2]} />
            <meshBasicMaterial
              map={sponsors.frontWing}
              transparent
              alphaTest={0.3}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
          {/* Front wing endplates - with curve */}
          {[-0.78, 0.78].map((x, i) => (
            <group key={`fw-ep-${i}`}>
              <mesh position={[x, 0.12, 1.95]} castShadow>
                <boxGeometry args={[0.035, 0.13, 0.42]} />
                <meshStandardMaterial
                  color="#111"
                  metalness={0.5}
                  roughness={0.3}
                />
              </mesh>
              <mesh position={[x, 0.06, 2.14]} rotation={[0, 0, Math.PI / 2]}>
                <torusGeometry args={[0.05, 0.012, 6, 8, Math.PI / 2]} />
                <meshStandardMaterial
                  color="#111"
                  metalness={0.5}
                  roughness={0.3}
                />
              </mesh>
            </group>
          ))}
          {/* Front wing pylons */}
          {[-0.1, 0.1].map((x, i) => (
            <mesh
              key={`fw-pylon-${i}`}
              position={[x, 0.13, 1.85]}
              rotation={[0.15, 0, 0]}
            >
              <cylinderGeometry args={[0.012, 0.018, 0.1, 6]} />
              <meshStandardMaterial
                color="#222"
                metalness={0.6}
                roughness={0.3}
              />
            </mesh>
          ))}

          {/* Rear wing - multi-element */}
          <mesh position={[0, 0.58, -1.5]} rotation={[-0.12, 0, 0]} castShadow>
            <boxGeometry args={[1.1, 0.035, 0.2]} />
            <meshStandardMaterial
              color={color}
              metalness={0.4}
              roughness={0.35}
            />
          </mesh>
          {/* Rear wing upper flap */}
          <mesh position={[0, 0.64, -1.48]} rotation={[-0.28, 0, 0]} castShadow>
            <boxGeometry args={[1.05, 0.025, 0.13]} />
            <meshStandardMaterial
              color={color}
              metalness={0.4}
              roughness={0.35}
            />
          </mesh>
          {/* Rear wing endplates - curved */}
          {[-0.55, 0.55].map((x, i) => (
            <group key={`rw-ep-${i}`}>
              <mesh position={[x, 0.52, -1.5]} castShadow>
                <boxGeometry args={[0.025, 0.28, 0.32]} />
                <meshStandardMaterial
                  color="#111"
                  metalness={0.5}
                  roughness={0.3}
                />
              </mesh>
              <mesh position={[x, 0.66, -1.38]} rotation={[0, Math.PI / 2, 0]}>
                <torusGeometry args={[0.04, 0.01, 6, 8, Math.PI / 2]} />
                <meshStandardMaterial
                  color="#111"
                  metalness={0.5}
                  roughness={0.3}
                />
              </mesh>
            </group>
          ))}
          {/* Rear wing supports - curved pylons */}
          {[-0.3, 0.3].map((x, i) => (
            <mesh
              key={`rw-sup-${i}`}
              position={[x, 0.44, -1.45]}
              rotation={[0.1, 0, 0]}
              castShadow
            >
              <cylinderGeometry args={[0.018, 0.022, 0.22, 8]} />
              <meshStandardMaterial
                color="#222"
                metalness={0.7}
                roughness={0.2}
              />
            </mesh>
          ))}

          {/* Exhaust pipes */}
          {[-0.18, 0.18].map((x, i) => (
            <group key={`exhaust-${i}`} position={[x, 0.18, -1.65]}>
              {/* Outer pipe */}
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.08, 0.09, 0.15, 12]} />
                <meshStandardMaterial
                  color="#222222"
                  metalness={0.8}
                  roughness={0.3}
                />
              </mesh>
              {/* Inner hole (dark) */}
              <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.16, 0]}>
                <cylinderGeometry args={[0.06, 0.06, 0.02, 12]} />
                <meshStandardMaterial
                  color="#000000"
                  metalness={0.9}
                  roughness={0.1}
                />
              </mesh>
              {/* Chrome tip ring */}
              <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.15, 0]}>
                <torusGeometry args={[0.07, 0.012, 8, 16]} />
                <meshStandardMaterial
                  color="#cccccc"
                  metalness={0.95}
                  roughness={0.05}
                />
              </mesh>
            </group>
          ))}

          {/* Side pods - curved capsule design */}
          {[-0.5, 0.5].map((x, i) => (
            <group key={`sidepod-${i}`}>
              {/* Sidepod main body */}
              <mesh
                position={[x, 0.28, -0.1]}
                rotation={[Math.PI / 2, 0, 0]}
                castShadow
              >
                <capsuleGeometry args={[0.13, 1.1, 8, 12]} />
                <meshStandardMaterial
                  color={color}
                  metalness={0.4}
                  roughness={0.35}
                />
              </mesh>
              {/* Sidepod intake - curved scoop */}
              <mesh
                position={[x, 0.34, 0.5]}
                rotation={[0.3, i === 0 ? 0.2 : -0.2, 0]}
              >
                <sphereGeometry
                  args={[0.12, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2]}
                />
                <meshStandardMaterial
                  color="#111"
                  metalness={0.9}
                  roughness={0.1}
                  side={THREE.DoubleSide}
                />
              </mesh>
              {/* Sidepod undercut */}
              <mesh
                position={[x * 0.9, 0.14, -0.2]}
                rotation={[Math.PI / 2, 0, 0]}
              >
                <cylinderGeometry args={[0.06, 0.1, 0.9, 8]} />
                <meshStandardMaterial
                  color="#1a1a1a"
                  metalness={0.3}
                  roughness={0.6}
                />
              </mesh>
              {/* Side sponsor decal */}
              <mesh
                position={[x + (i === 0 ? -0.18 : 0.18), 0.3, -0.1]}
                rotation={[0, i === 0 ? -Math.PI / 2 : Math.PI / 2, 0]}
              >
                <planeGeometry args={[1.0, 0.16]} />
                <meshBasicMaterial
                  map={sponsors.side}
                  transparent
                  alphaTest={0.3}
                  depthWrite={false}
                  side={THREE.DoubleSide}
                />
              </mesh>
              {/* Sidepod number */}
              <mesh
                position={[x + (i === 0 ? -0.18 : 0.18), 0.3, 0.35]}
                rotation={[0, i === 0 ? -Math.PI / 2 : Math.PI / 2, 0]}
              >
                <planeGeometry args={[0.2, 0.2]} />
                <meshBasicMaterial
                  map={numberTexture}
                  transparent
                  alphaTest={0.3}
                  depthWrite={false}
                  side={THREE.DoubleSide}
                />
              </mesh>
            </group>
          ))}

          {/* Floor / undertray */}
          <mesh position={[0, 0.06, 0]} castShadow>
            <boxGeometry args={[1.05, 0.035, 2.8]} />
            <meshStandardMaterial
              color="#111"
              metalness={0.3}
              roughness={0.7}
            />
          </mesh>
          {/* Floor edge rails - rounded */}
          {[-0.53, 0.53].map((x, i) => (
            <mesh
              key={`floor-rail-${i}`}
              position={[x, 0.08, 0]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <cylinderGeometry args={[0.018, 0.018, 2.8, 6]} />
              <meshStandardMaterial
                color="#222"
                metalness={0.4}
                roughness={0.5}
              />
            </mesh>
          ))}

          {/* Rear diffuser fins */}
          {[-0.3, -0.1, 0.1, 0.3].map((x, i) => (
            <mesh
              key={`diffuser-${i}`}
              position={[x, 0.1, -1.52]}
              rotation={[-0.3, 0, 0]}
            >
              <boxGeometry args={[0.025, 0.1, 0.3]} />
              <meshStandardMaterial
                color="#222"
                metalness={0.5}
                roughness={0.4}
              />
            </mesh>
          ))}

          {/* Bargeboards / aero vanes */}
          {[-0.36, 0.36].map((x, i) => (
            <group key={`bargeboard-${i}`}>
              <mesh
                position={[x, 0.22, 0.7]}
                rotation={[0, i === 0 ? -0.15 : 0.15, 0]}
              >
                <boxGeometry args={[0.018, 0.16, 0.35]} />
                <meshStandardMaterial
                  color="#222"
                  metalness={0.5}
                  roughness={0.4}
                />
              </mesh>
              <mesh
                position={[x * 0.85, 0.2, 0.85]}
                rotation={[0, i === 0 ? -0.25 : 0.25, 0]}
              >
                <boxGeometry args={[0.012, 0.08, 0.18]} />
                <meshStandardMaterial
                  color="#222"
                  metalness={0.5}
                  roughness={0.4}
                />
              </mesh>
            </group>
          ))}

          {/* Nose sponsor decal */}
          <mesh position={[0, 0.37, 1.3]}>
            <planeGeometry args={[0.5, 0.1]} />
            <meshBasicMaterial
              map={sponsors.nose}
              transparent
              alphaTest={0.3}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
          {/* Nose top number */}
          <mesh position={[0, 0.42, 1.0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.22, 0.22]} />
            <meshBasicMaterial
              map={numberTexture}
              transparent
              alphaTest={0.3}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>

          {/* Rear wing sponsor decal */}
          <mesh position={[0, 0.61, -1.5]} rotation={[0, Math.PI, 0]}>
            <planeGeometry args={[0.85, 0.12]} />
            <meshBasicMaterial
              map={sponsors.rear}
              transparent
              alphaTest={0.3}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
          {/* Rear wing endplate numbers */}
          {[-0.565, 0.565].map((x, i) => (
            <mesh
              key={`rw-num-${i}`}
              position={[x, 0.52, -1.5]}
              rotation={[0, i === 0 ? -Math.PI / 2 : Math.PI / 2, 0]}
            >
              <planeGeometry args={[0.2, 0.2]} />
              <meshBasicMaterial
                map={numberTexture}
                transparent
                alphaTest={0.3}
                depthWrite={false}
                side={THREE.DoubleSide}
              />
            </mesh>
          ))}

          {/* Wheels - F1 style with rotation */}
          {[
            [-0.65, 0.2, 1.1],
            [0.65, 0.2, 1.1], // Front
            [-0.65, 0.25, -1.0],
            [0.65, 0.25, -1.0], // Rear
          ].map((pos, i) => (
            <group key={i} position={pos as [number, number, number]}>
              <group
                ref={(element) => {
                  wheelRefs.current[i] = element;
                }}
              >
                {/* Tire */}
                <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
                  <cylinderGeometry
                    args={[i < 2 ? 0.22 : 0.28, i < 2 ? 0.22 : 0.28, 0.35, 16]}
                  />
                  <meshStandardMaterial color="#444444" roughness={0.9} />
                </mesh>
                {/* Tire grooves — 4 thin dark rings inset into tire */}
                {[-0.1, -0.035, 0.035, 0.1].map((offset, g) => {
                  const tireRadius = i < 2 ? 0.22 : 0.28;
                  return (
                    <mesh
                      key={`groove-${g}`}
                      rotation={[0, 0, Math.PI / 2]}
                      position={[offset, 0, 0]}
                    >
                      <cylinderGeometry
                        args={[
                          tireRadius + 0.002,
                          tireRadius + 0.002,
                          0.02,
                          16,
                        ]}
                      />
                      <meshStandardMaterial color="#1a1a1a" roughness={0.95} />
                    </mesh>
                  );
                })}
                {/* Rim */}
                <mesh rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.12, 0.12, 0.36, 8]} />
                  <meshStandardMaterial
                    color="#c0c0c0"
                    metalness={0.9}
                    roughness={0.1}
                  />
                </mesh>
                {/* Hub cover disc - faces outward along X axis */}
                <mesh
                  rotation={[0, Math.PI / 2, 0]}
                  position={[i % 2 === 0 ? -0.18 : 0.18, 0, 0]}
                >
                  <circleGeometry args={[i < 2 ? 0.18 : 0.22, 16]} />
                  <meshStandardMaterial
                    color="#888"
                    metalness={0.8}
                    roughness={0.2}
                    side={THREE.DoubleSide}
                  />
                </mesh>
              </group>
              {/* Brake caliper - doesn't rotate with wheel */}
              <mesh
                position={[
                  i % 2 === 0 ? 0.08 : -0.08,
                  -(i < 2 ? 0.06 : 0.1),
                  0,
                ]}
              >
                <boxGeometry args={[0.04, 0.05, 0.07]} />
                <meshStandardMaterial
                  color="#cc0000"
                  metalness={0.3}
                  roughness={0.5}
                />
              </mesh>
              {/* Suspension upper arm */}
              <mesh
                position={[i % 2 === 0 ? 0.25 : -0.25, 0.05, 0]}
                rotation={[0, 0, i % 2 === 0 ? -0.35 : 0.35]}
              >
                <cylinderGeometry args={[0.01, 0.01, 0.4, 6]} />
                <meshStandardMaterial
                  color="#333"
                  metalness={0.7}
                  roughness={0.3}
                />
              </mesh>
              {/* Suspension lower arm */}
              <mesh
                position={[i % 2 === 0 ? 0.25 : -0.25, -0.05, 0]}
                rotation={[0, 0, i % 2 === 0 ? 0.2 : -0.2]}
              >
                <cylinderGeometry args={[0.01, 0.01, 0.4, 6]} />
                <meshStandardMaterial
                  color="#333"
                  metalness={0.7}
                  roughness={0.3}
                />
              </mesh>
            </group>
          ))}

          {/* Boost flames */}
          {isBoosting && (
            <group ref={boostFlameRef}>
              {/* Left exhaust flame - horizontal, pointing backward (-Z) */}
              <mesh
                position={[-0.25, 0.2, -2.2]}
                rotation={[Math.PI / 2, 0, 0]}
              >
                <coneGeometry args={[0.15, 1.2, 8]} />
                <meshBasicMaterial color="#ff6600" transparent opacity={0.9} />
              </mesh>
              <mesh
                position={[-0.25, 0.2, -2.6]}
                rotation={[Math.PI / 2, 0, 0]}
              >
                <coneGeometry args={[0.08, 0.8, 8]} />
                <meshBasicMaterial color="#ffcc00" transparent opacity={0.85} />
              </mesh>

              {/* Right exhaust flame - horizontal, pointing backward (-Z) */}
              <mesh position={[0.25, 0.2, -2.2]} rotation={[Math.PI / 2, 0, 0]}>
                <coneGeometry args={[0.15, 1.2, 8]} />
                <meshBasicMaterial color="#ff6600" transparent opacity={0.9} />
              </mesh>
              <mesh position={[0.25, 0.2, -2.6]} rotation={[Math.PI / 2, 0, 0]}>
                <coneGeometry args={[0.08, 0.8, 8]} />
                <meshBasicMaterial color="#ffcc00" transparent opacity={0.85} />
              </mesh>

              {/* Boost glow light */}
              <pointLight
                position={[0, 0.3, -2.5]}
                intensity={8}
                distance={10}
                color="#ff8800"
              />
            </group>
          )}

          {/* Boost trail particles - always mounted, visibility controlled in useFrame */}
          <points ref={boostTrailRef} visible={false}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                count={BOOST_TRAIL_COUNT}
                array={boostTrailPositions}
                itemSize={3}
              />
              <bufferAttribute
                attach="attributes-color"
                count={BOOST_TRAIL_COUNT}
                array={boostTrailColors}
                itemSize={3}
              />
            </bufferGeometry>
            <pointsMaterial
              size={0.04}
              transparent
              opacity={0.85}
              vertexColors
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </points>
        </>
      </group>
    </group>
  );
};
