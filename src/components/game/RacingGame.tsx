import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Sky } from "@react-three/drei";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import * as THREE from "three";
import { Car } from "./Car";
import { Track, buildTrackPath, buildTrackBounds } from "./Track";
import { SkidMarks, SkidMarkHandle } from "./SkidMarks";
import { GameHUD } from "./GameHUD";
import { Minimap } from "./Minimap";
import { StartCountdown } from "./StartCountdown";
import { soundEngine } from "./SoundEngine";
import { Leaderboard, SubmitScore } from "./Leaderboard";
import { TrackSpectators } from "./Spectators";
import {
  GhostCar,
  GhostFrame,
  GhostLapData,
  saveGhostLap,
  loadGhostLap,
} from "./GhostCar";
import {
  TrackContext,
  getTrackConfiguration,
  listTrackConfigurations,
  DEFAULT_TRACK_IDENTIFIER,
} from "./tracks";
import type { TrackIdentifier } from "./tracks";

const AI_COLORS: string[] = []; // No AI cars
const TRACK_WIDTH = 20;
const LAP_OPTIONS = [3, 5, 7, 10];
const CAR_COLORS = [
  { label: "Red", value: "#ff2d2d", preview: "#e63946" },
  { label: "Orange", value: "#ffa500", preview: "#ff8c00" },
  { label: "Blue", value: "#4d8fff", preview: "#2563eb" },
  { label: "White", value: "#ffffff", preview: "#f0f0f0" },
];

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${mins}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(3, "0")}`;
};

const FollowCamera = ({
  playerPos,
  playerRot,
}: {
  playerPos: THREE.Vector3 | null;
  playerRot: number;
}) => {
  const { camera } = useThree();
  const smoothPos = useRef(new THREE.Vector3(0, 15, -20));
  const smoothLook = useRef(new THREE.Vector3(0, 0, 0));

  useFrame(() => {
    if (!playerPos) return;

    const idealOffset = new THREE.Vector3(
      -Math.sin(playerRot) * 12,
      6,
      -Math.cos(playerRot) * 12,
    );
    idealOffset.add(playerPos);

    smoothPos.current.lerp(idealOffset, 0.06);
    smoothLook.current.lerp(playerPos, 0.12);

    camera.position.copy(smoothPos.current);
    camera.lookAt(smoothLook.current);
  });

  return null;
};

export const RacingGame = () => {
  const [controls, setControls] = useState({
    forward: false,
    backward: false,
    left: false,
    right: false,
    boost: false,
  });
  const [playerPosition, setPlayerPosition] = useState<THREE.Vector3 | null>(
    null,
  );
  const [playerRotation, setPlayerRotation] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [carPositions, setCarPositions] = useState<Map<string, THREE.Vector3>>(
    new Map(),
  );
  const [raceStarted, setRaceStarted] = useState(false);
  const [soundInitialized, setSoundInitialized] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [playerProgress, setPlayerProgress] = useState(0);
  const [lap, setLap] = useState(1);
  const [raceFinished, setRaceFinished] = useState(false);
  const [totalLaps, setTotalLaps] = useState<number | null>(null);
  const [selectedLaps, setSelectedLaps] = useState<number>(3);
  const [showStartScreen, setShowStartScreen] = useState(true);
  const [countdownReady, setCountdownReady] = useState(false);
  const [playerColor, setPlayerColor] = useState(CAR_COLORS[0].value);
  const [lapTimes, setLapTimes] = useState<number[]>([]);
  const [lastLapTime, setLastLapTime] = useState<number | null>(null);
  const [showLastLap, setShowLastLap] = useState(false);
  const [boostUsedThisLap, setBoostUsedThisLap] = useState(false);
  const [boostActive, setBoostActive] = useState(false);
  const [firstLapCrossed, setFirstLapCrossed] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<TrackIdentifier>(
    DEFAULT_TRACK_IDENTIFIER,
  );
  const lapStartTimeRef = useRef(0);
  const raceStartTimeRef = useRef(0);
  const prevProgressRef = useRef(0);
  const skidMarksRef = useRef<SkidMarkHandle>(null);

  // Track context value — computed from selected track
  const trackContextValue = useMemo(() => {
    const configuration = getTrackConfiguration(selectedTrack);
    const trackPath = buildTrackPath(configuration.definition.controlPoints);
    const trackBounds = buildTrackBounds(
      trackPath,
      configuration.definition.trackWidth,
      configuration.definition.samplePointCount,
    );
    return { configuration, trackPath, trackBounds };
  }, [selectedTrack]);

  // Ghost system
  const [ghostData, setGhostData] = useState<GhostLapData | null>(null);
  const [ghostLapStartTime, setGhostLapStartTime] = useState(0);
  const [bestLapTime, setBestLapTime] = useState<number>(Infinity);
  const currentLapRecording = useRef<GhostFrame[]>([]);
  const lastGhostRecordTime = useRef(0);
  const GHOST_RECORD_INTERVAL = 100; // ms

  // Initialize sound on first user interaction
  useEffect(() => {
    const initSound = async () => {
      soundEngine.resume();
      await soundEngine.loadEngineSound("/sounds/engine-loop.mp3");
      setSoundInitialized(true);
      window.removeEventListener("click", initSound);
      window.removeEventListener("keydown", initSound);
    };
    window.addEventListener("click", initSound);
    window.addEventListener("keydown", initSound);
    return () => {
      window.removeEventListener("click", initSound);
      window.removeEventListener("keydown", initSound);
      soundEngine.dispose();
    };
  }, []);

  // Mute/unmute based on soundEnabled
  useEffect(() => {
    if (soundInitialized) {
      soundEngine.setMasterVolume(soundEnabled ? 1 : 0);
    }
  }, [soundEnabled, soundInitialized]);

  // Update engine sound based on speed
  useEffect(() => {
    if (raceStarted && soundInitialized) {
      soundEngine.startEngine();
    }
    soundEngine.updateEngine(speed);
  }, [speed, raceStarted, soundInitialized]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!raceStarted) return;
      switch (e.key.toLowerCase()) {
        case "w":
        case "arrowup":
          setControls((c) => ({ ...c, forward: true }));
          break;
        case "s":
        case "arrowdown":
          setControls((c) => ({ ...c, backward: true }));
          break;
        case "a":
        case "arrowleft":
          setControls((c) => ({ ...c, left: true }));
          break;
        case "d":
        case "arrowright":
          setControls((c) => ({ ...c, right: true }));
          break;
        case " ":
          e.preventDefault();
          if (!boostUsedThisLap && !boostActive) {
            setBoostUsedThisLap(true);
            setBoostActive(true);
            setControls((c) => ({ ...c, boost: true }));
            setTimeout(() => {
              setBoostActive(false);
              setControls((c) => ({ ...c, boost: false }));
            }, 2000);
          }
          break;
        case "r":
          window.location.reload();
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.key.toLowerCase()) {
        case "w":
        case "arrowup":
          setControls((c) => ({ ...c, forward: false }));
          break;
        case "s":
        case "arrowdown":
          setControls((c) => ({ ...c, backward: false }));
          break;
        case "a":
        case "arrowleft":
          setControls((c) => ({ ...c, left: false }));
          break;
        case "d":
        case "arrowright":
          setControls((c) => ({ ...c, right: false }));
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [raceStarted, boostUsedThisLap, boostActive]);

  // Load saved ghost for current track
  useEffect(() => {
    const saved = loadGhostLap(selectedTrack);
    if (saved && saved.length > 2) {
      setGhostData(saved);
    }
  }, [selectedTrack]);

  const handlePlayerUpdate = useCallback(
    (
      position: THREE.Vector3,
      rotation: number,
      currentSpeed: number,
      trackProgress: number,
    ) => {
      setPlayerPosition(position);
      setPlayerRotation(rotation);
      setSpeed(currentSpeed);
      setPlayerProgress(trackProgress);

      // Ghost recording — sample every GHOST_RECORD_INTERVAL ms
      const now = performance.now();
      if (now - lastGhostRecordTime.current >= GHOST_RECORD_INTERVAL) {
        lastGhostRecordTime.current = now;
        const elapsed = (now - lapStartTimeRef.current) / 1000;
        currentLapRecording.current.push({
          time: elapsed,
          x: position.x,
          y: position.y,
          z: position.z,
          rotation,
        });
      }

      // Detect lap completion: progress wraps from high (>0.9) to low (<0.1)
      if (prevProgressRef.current > 0.85 && trackProgress < 0.15) {
        // First crossing of the start line after race begins — don't count as a lap
        if (!firstLapCrossed) {
          setFirstLapCrossed(true);
          lapStartTimeRef.current = now;
          currentLapRecording.current = [];
          lastGhostRecordTime.current = now;
          setGhostLapStartTime(now);
          prevProgressRef.current = trackProgress;
          return;
        }

        const lapTime = (now - lapStartTimeRef.current) / 1000;

        // Save ghost if this is a new best lap
        if (lapTime < bestLapTime && currentLapRecording.current.length > 2) {
          setBestLapTime(lapTime);
          const completedRecording = [...currentLapRecording.current];
          setGhostData(completedRecording);
          saveGhostLap(selectedTrack, completedRecording);
        }

        // Reset recording for next lap
        lapStartTimeRef.current = now;
        currentLapRecording.current = [];
        lastGhostRecordTime.current = now;
        setGhostLapStartTime(now);

        setLapTimes((prev) => [...prev, lapTime]);
        setLastLapTime(lapTime);
        setShowLastLap(true);
        setTimeout(() => setShowLastLap(false), 3000);

        setBoostUsedThisLap(false);
        setLap((prev) => {
          const newLap = prev + 1;
          if (newLap > (totalLaps || 10)) {
            setRaceFinished(true);
            soundEngine.stopEngine();
          }
          return newLap;
        });
      }
      prevProgressRef.current = trackProgress;
    },
    [totalLaps, firstLapCrossed, bestLapTime],
  );

  const handlePositionUpdate = useCallback(
    (id: string, position: THREE.Vector3) => {
      setCarPositions((prev) => {
        const newMap = new Map(prev);
        newMap.set(id, position);
        return newMap;
      });
    },
    [],
  );

  const handleRaceStart = useCallback(() => {
    setRaceStarted(true);
    lapStartTimeRef.current = performance.now();
    raceStartTimeRef.current = performance.now();
  }, []);

  const handleSkidmarkUpdate = useCallback(
    (
      wheelPositions: THREE.Vector3[],
      forwardDirection: THREE.Vector3,
      skidIntensity: number,
    ) => {
      if (!skidMarksRef.current) return;
      wheelPositions.forEach((wheelPosition, wheelIndex) => {
        skidMarksRef.current!.addSegment(
          wheelPosition,
          forwardDirection,
          skidIntensity,
          "player",
          wheelIndex,
        );
      });
    },
    [],
  );

  const handleRestart = useCallback(() => {
    window.location.reload();
  }, []);

  const handleCountdownBeep = useCallback(
    (final: boolean) => {
      if (soundInitialized) {
        soundEngine.playCountdownBeep(final);
      }
    },
    [soundInitialized],
  );

  const currentLap = Math.min(lap, totalLaps || 10);

  return (
    <TrackContext.Provider value={trackContextValue}>
      <div className="w-full h-screen bg-background relative">
        <Canvas shadows dpr={[1, 1.5]} performance={{ min: 0.5 }}>
          <FollowCamera playerPos={playerPosition} playerRot={playerRotation} />

          <Sky
            distance={450000}
            sunPosition={
              trackContextValue.configuration.environment.sky.sunPosition
            }
            inclination={
              trackContextValue.configuration.environment.sky.inclination
            }
            azimuth={trackContextValue.configuration.environment.sky.azimuth}
            rayleigh={trackContextValue.configuration.environment.sky.rayleigh}
            turbidity={
              trackContextValue.configuration.environment.sky.turbidity
            }
            mieCoefficient={0.005}
            mieDirectionalG={0.8}
          />

          <ambientLight
            intensity={
              trackContextValue.configuration.environment.lighting
                .ambientIntensity
            }
            color={
              trackContextValue.configuration.environment.lighting.ambientColor
            }
          />
          <directionalLight
            position={
              trackContextValue.configuration.environment.lighting
                .directionalPosition
            }
            intensity={
              trackContextValue.configuration.environment.lighting
                .directionalIntensity
            }
            color={
              trackContextValue.configuration.environment.lighting
                .directionalColor
            }
            castShadow
            shadow-mapSize={[1024, 1024]}
            shadow-camera-far={500}
            shadow-camera-left={-250}
            shadow-camera-right={250}
            shadow-camera-top={250}
            shadow-camera-bottom={-250}
            shadow-bias={-0.0005}
          />
          <hemisphereLight
            args={
              trackContextValue.configuration.environment.lighting
                .hemisphereColors
            }
          />

          <Track width={TRACK_WIDTH} />
          <TrackSpectators />
          <SkidMarks ref={skidMarksRef} />

          <Car
            id="player"
            position={[0, 0, 0]}
            color={playerColor}
            isPlayer
            controls={
              raceStarted && !raceFinished
                ? controls
                : {
                    forward: false,
                    backward: false,
                    left: false,
                    right: false,
                    boost: false,
                  }
            }
            onUpdate={handlePlayerUpdate}
            onPositionUpdate={handlePositionUpdate}
            onSkidmarkUpdate={handleSkidmarkUpdate}
            otherCars={carPositions}
            trackWidth={TRACK_WIDTH}
            raceStarted={raceStarted && !raceFinished}
          />

          {/* Ghost car — best lap replay */}
          {ghostData && ghostData.length > 2 && ghostLapStartTime > 0 && (
            <GhostCar
              ghostData={ghostData}
              lapStartTime={ghostLapStartTime}
              color="#88ccff"
            />
          )}

          {AI_COLORS.map((color, index) => (
            <Car
              key={index}
              id={`ai-${index}`}
              position={[0, 0, 0]}
              color={color}
              aiIndex={index}
              onPositionUpdate={handlePositionUpdate}
              otherCars={carPositions}
              trackWidth={TRACK_WIDTH}
              raceStarted={raceStarted && !raceFinished}
              playerProgress={playerProgress}
            />
          ))}
        </Canvas>

        {/* Lap selection screen */}
        {showStartScreen && (
          <div className="absolute inset-0 bg-background/90 backdrop-blur-md flex items-center justify-center z-50">
            <div className="flex flex-col items-center gap-8 w-full max-w-lg px-6">
              <h1 className="text-5xl font-bold text-primary">
                🏎️ Racing Game
              </h1>

              {/* Car color selection */}
              <div className="flex flex-col items-center gap-3 w-full">
                <p className="text-base text-muted-foreground tracking-wide">
                  Car Color
                </p>
                <div className="flex gap-5 justify-center">
                  {CAR_COLORS.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => setPlayerColor(c.value)}
                      className={`w-14 h-14 rounded-xl border-2 transition-all pointer-events-auto flex items-center justify-center ${
                        playerColor === c.value
                          ? "border-primary scale-110 shadow-lg"
                          : "border-border hover:border-primary/50"
                      }`}
                      style={{ backgroundColor: c.preview }}
                    >
                      {playerColor === c.value && (
                        <span className="text-lg drop-shadow-md">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Lap selection */}
              <div className="flex flex-col items-center gap-3 w-full">
                <p className="text-base text-muted-foreground tracking-wide">
                  Laps
                </p>
                <div className="flex gap-4 justify-center">
                  {LAP_OPTIONS.map((laps) => (
                    <button
                      key={laps}
                      onClick={() => setSelectedLaps(laps)}
                      className={`w-16 h-16 rounded-xl bg-card border-2 text-xl font-bold text-foreground transition-all pointer-events-auto ${
                        selectedLaps === laps
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50 hover:bg-primary/5"
                      }`}
                    >
                      {laps}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sound toggle */}
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="px-5 py-2.5 rounded-xl bg-card border-2 border-border text-foreground hover:border-primary hover:bg-primary/10 transition-all pointer-events-auto flex items-center gap-2"
              >
                {soundEnabled ? "🔊" : "🔇"}
                <span className="text-sm font-medium">
                  Sound {soundEnabled ? "ON" : "OFF"}
                </span>
              </button>

              {/* Race Start button */}
              <button
                onClick={() => {
                  setTotalLaps(selectedLaps);
                  setShowStartScreen(false);
                  setCountdownReady(true);
                }}
                className="w-64 py-4 rounded-xl bg-primary text-primary-foreground text-2xl font-bold hover:opacity-90 transition-all pointer-events-auto"
              >
                🏁 Race Start
              </button>

              <Leaderboard />
            </div>
          </div>
        )}

        {countdownReady && (
          <StartCountdown
            onStart={handleRaceStart}
            onBeep={handleCountdownBeep}
          />
        )}

        <GameHUD
          speed={speed}
          lap={currentLap}
          totalLaps={totalLaps || 10}
          boostAvailable={!boostUsedThisLap}
          boostActive={boostActive}
        />

        <Minimap
          carPositions={carPositions}
          playerPosition={playerPosition}
          trackWidth={TRACK_WIDTH}
          playerColor={playerColor}
        />

        {/* Boost screen effect */}
        {boostActive && (
          <div className="absolute inset-0 pointer-events-none z-30">
            {/* Speed lines on sides */}
            <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-orange-500/20 to-transparent animate-pulse" />
            <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-orange-500/20 to-transparent animate-pulse" />
            {/* Top/bottom vignette */}
            <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-orange-500/15 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-orange-500/15 to-transparent" />
            {/* Center text */}
            <div className="absolute top-12 left-1/2 -translate-x-1/2">
              <span className="text-2xl font-bold text-orange-400 animate-pulse drop-shadow-lg">
                🔥 BOOST! 🔥
              </span>
            </div>
          </div>
        )}

        {/* Lap time flash */}
        {showLastLap && lastLapTime !== null && !raceFinished && (
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 z-40 animate-pulse">
            <div className="bg-card/90 backdrop-blur-sm rounded-xl px-6 py-3 border border-border">
              <p className="text-sm text-muted-foreground">
                Lap {lap - 1} Complete
              </p>
              <p className="text-3xl font-bold text-primary font-mono">
                {formatTime(lastLapTime)}
              </p>
            </div>
          </div>
        )}

        {/* Race Finished overlay */}
        {raceFinished && (
          <div className="absolute inset-0 bg-background/90 backdrop-blur-md flex items-center justify-center z-50">
            <div className="text-center max-w-md w-full">
              <h2 className="text-5xl font-bold text-primary mb-2">
                🏁 Race Complete!
              </h2>
              <p className="text-lg text-muted-foreground mb-6">
                {totalLaps} Laps Finished
              </p>

              {/* Lap times table */}
              <div className="bg-card/80 rounded-xl border border-border p-4 mb-6 text-left">
                <div className="flex flex-col gap-1 mb-3">
                  {lapTimes.map((time, i) => (
                    <div
                      key={i}
                      className="flex justify-between px-3 py-1.5 rounded-md odd:bg-muted/30"
                    >
                      <span className="text-sm text-muted-foreground">
                        Lap {i + 1}
                      </span>
                      <span
                        className={`text-sm font-mono font-bold ${time === Math.min(...lapTimes) ? "text-primary" : "text-foreground"}`}
                      >
                        {formatTime(time)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-border pt-3 flex justify-between px-3">
                  <span className="text-sm font-bold text-muted-foreground">
                    Total Time
                  </span>
                  <span className="text-sm font-mono font-bold text-primary">
                    {formatTime(lapTimes.reduce((a, b) => a + b, 0))}
                  </span>
                </div>
                <div className="flex justify-between px-3 mt-1">
                  <span className="text-sm font-bold text-muted-foreground">
                    Best Lap
                  </span>
                  <span className="text-sm font-mono font-bold text-primary">
                    {formatTime(Math.min(...lapTimes))}
                  </span>
                </div>
              </div>

              <div className="mb-4">
                <SubmitScore
                  bestLapTime={Math.min(...lapTimes)}
                  totalLaps={totalLaps || 3}
                  onSubmitted={() => {}}
                />
              </div>

              <button
                onClick={handleRestart}
                className="px-8 py-4 bg-primary text-primary-foreground rounded-lg text-xl font-bold hover:opacity-90 transition-opacity pointer-events-auto"
              >
                Restart
              </button>
            </div>
          </div>
        )}
      </div>
    </TrackContext.Provider>
  );
};
