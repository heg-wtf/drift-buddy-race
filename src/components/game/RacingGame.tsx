import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Sky, Cloud } from '@react-three/drei';
import { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { Car } from './Car';
import { Track } from './Track';
import { GameHUD } from './GameHUD';
import { Minimap } from './Minimap';
import { StartCountdown } from './StartCountdown';
import { soundEngine } from './SoundEngine';

const AI_COLORS: string[] = []; // No AI cars
const TRACK_WIDTH = 20;
const TOTAL_LAPS = 10;

const FollowCamera = ({ playerPos, playerRot }: { playerPos: THREE.Vector3 | null; playerRot: number }) => {
  const { camera } = useThree();
  const smoothPos = useRef(new THREE.Vector3(0, 15, -20));
  const smoothLook = useRef(new THREE.Vector3(0, 0, 0));
  
  useFrame(() => {
    if (!playerPos) return;
    
    const idealOffset = new THREE.Vector3(
      -Math.sin(playerRot) * 12,
      6,
      -Math.cos(playerRot) * 12
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
  });
  const [playerPosition, setPlayerPosition] = useState<THREE.Vector3 | null>(null);
  const [playerRotation, setPlayerRotation] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [carPositions, setCarPositions] = useState<Map<string, THREE.Vector3>>(new Map());
  const [damages, setDamages] = useState<Map<string, number>>(new Map());
  const [gameOver, setGameOver] = useState(false);
  const [raceStarted, setRaceStarted] = useState(false);
  const [soundInitialized, setSoundInitialized] = useState(false);
  const [playerProgress, setPlayerProgress] = useState(0);
  const [lap, setLap] = useState(1);
  const [raceFinished, setRaceFinished] = useState(false);
  const prevProgressRef = useRef(0);
  const prevDamageRef = useRef<Map<string, number>>(new Map());

  // Initialize sound on first user interaction
  useEffect(() => {
    const initSound = () => {
      soundEngine.resume();
      setSoundInitialized(true);
      window.removeEventListener('click', initSound);
      window.removeEventListener('keydown', initSound);
    };
    window.addEventListener('click', initSound);
    window.addEventListener('keydown', initSound);
    return () => {
      window.removeEventListener('click', initSound);
      window.removeEventListener('keydown', initSound);
      soundEngine.dispose();
    };
  }, []);

  // Update engine sound based on speed
  useEffect(() => {
    if (raceStarted && soundInitialized) {
      soundEngine.startEngine();
    }
    soundEngine.updateEngine(speed);
  }, [speed, raceStarted, soundInitialized]);

  // Play collision sound on damage changes
  useEffect(() => {
    if (!soundInitialized) return;
    const playerDmg = damages.get('player') || 0;
    const prevDmg = prevDamageRef.current.get('player') || 0;
    if (playerDmg > prevDmg) {
      soundEngine.playCollision();
    }
    if (playerDmg >= 100 && prevDmg < 100) {
      soundEngine.playDestroy();
      soundEngine.stopEngine();
    }
    prevDamageRef.current = new Map(damages);
  }, [damages, soundInitialized]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!raceStarted) return;
      switch (e.key.toLowerCase()) {
        case 'w':
        case 'arrowup':
          setControls(c => ({ ...c, forward: true }));
          break;
        case 's':
        case 'arrowdown':
          setControls(c => ({ ...c, backward: true }));
          break;
        case 'a':
        case 'arrowleft':
          setControls(c => ({ ...c, left: true }));
          break;
        case 'd':
        case 'arrowright':
          setControls(c => ({ ...c, right: true }));
          break;
        case 'r':
          window.location.reload();
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.key.toLowerCase()) {
        case 'w':
        case 'arrowup':
          setControls(c => ({ ...c, forward: false }));
          break;
        case 's':
        case 'arrowdown':
          setControls(c => ({ ...c, backward: false }));
          break;
        case 'a':
        case 'arrowleft':
          setControls(c => ({ ...c, left: false }));
          break;
        case 'd':
        case 'arrowright':
          setControls(c => ({ ...c, right: false }));
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [raceStarted]);

  const handlePlayerUpdate = useCallback((position: THREE.Vector3, rotation: number, currentSpeed: number, trackProgress: number) => {
    setPlayerPosition(position);
    setPlayerRotation(rotation);
    setSpeed(currentSpeed);
    setPlayerProgress(trackProgress);
    
    // Detect lap completion: progress wraps from high (>0.9) to low (<0.1)
    if (prevProgressRef.current > 0.85 && trackProgress < 0.15) {
      setLap(prev => {
        const newLap = prev + 1;
        if (newLap > TOTAL_LAPS) {
          setRaceFinished(true);
        }
        return newLap;
      });
    }
    prevProgressRef.current = trackProgress;
  }, []);

  const handlePositionUpdate = useCallback((id: string, position: THREE.Vector3) => {
    setCarPositions(prev => {
      const newMap = new Map(prev);
      newMap.set(id, position);
      return newMap;
    });
  }, []);

  const handleDamage = useCallback((id: string, amount: number) => {
    setDamages(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(id) || 0;
      const newDamage = Math.min(current + amount, 100);
      newMap.set(id, newDamage);
      
      if (id === 'player' && newDamage >= 100) {
        setGameOver(true);
      }
      
      return newMap;
    });
  }, []);

  const handleRaceStart = useCallback(() => {
    setRaceStarted(true);
  }, []);

  const handleCountdownBeep = useCallback((final: boolean) => {
    if (soundInitialized) {
      soundEngine.playCountdownBeep(final);
    }
  }, [soundInitialized]);

  const playerDamage = damages.get('player') || 0;
  const currentLap = Math.min(lap, TOTAL_LAPS);

  return (
    <div className="w-full h-screen bg-background relative">
      <Canvas shadows>
        <FollowCamera playerPos={playerPosition} playerRot={playerRotation} />
        
        <Sky 
          distance={450000} 
          sunPosition={[100, 50, 100]} 
          inclination={0.6}
          azimuth={0.25}
        />
        
        <Cloud position={[-20, 30, -30]} speed={0.2} opacity={0.5} />
        <Cloud position={[20, 35, -20]} speed={0.2} opacity={0.4} />
        <Cloud position={[0, 32, 20]} speed={0.15} opacity={0.6} />
        
        <ambientLight intensity={0.6} />
        <directionalLight
          position={[80, 100, 50]}
          intensity={1.5}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-far={200}
          shadow-camera-left={-100}
          shadow-camera-right={100}
          shadow-camera-top={100}
          shadow-camera-bottom={-100}
        />
        <hemisphereLight args={['#87ceeb', '#3d7a37', 0.5]} />
        
        <Track width={TRACK_WIDTH} />
        
        <Car
          id="player"
          position={[0, 0, 0]}
          color="#00ff88"
          isPlayer
          controls={raceStarted && !raceFinished ? controls : { forward: false, backward: false, left: false, right: false }}
          onUpdate={handlePlayerUpdate}
          onPositionUpdate={handlePositionUpdate}
          otherCars={carPositions}
          damage={playerDamage}
          onDamage={handleDamage}
          trackWidth={TRACK_WIDTH}
          raceStarted={raceStarted && !raceFinished}
        />
        
        {AI_COLORS.map((color, index) => (
          <Car
            key={index}
            id={`ai-${index}`}
            position={[0, 0, 0]}
            color={color}
            aiIndex={index}
            onPositionUpdate={handlePositionUpdate}
            otherCars={carPositions}
            damage={damages.get(`ai-${index}`) || 0}
            onDamage={handleDamage}
            trackWidth={TRACK_WIDTH}
            raceStarted={raceStarted && !raceFinished}
            playerProgress={playerProgress}
          />
        ))}
      </Canvas>
      
      <StartCountdown onStart={handleRaceStart} onBeep={handleCountdownBeep} />
      
      <GameHUD
        speed={speed}
        position={1}
        totalCars={5}
        lap={currentLap}
        totalLaps={TOTAL_LAPS}
        damage={playerDamage}
      />

      <Minimap 
        carPositions={carPositions} 
        playerPosition={playerPosition}
        trackWidth={TRACK_WIDTH}
      />

      {/* Race Finished overlay */}
      {raceFinished && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="text-center">
            <h2 className="text-5xl font-bold text-primary mb-4">🏁 레이스 완료!</h2>
            <p className="text-xl text-muted-foreground mb-8">{TOTAL_LAPS}랩을 완주했습니다!</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-8 py-4 bg-primary text-primary-foreground rounded-lg text-xl font-bold hover:opacity-90 transition-opacity pointer-events-auto"
            >
              다시 시작 (R)
            </button>
          </div>
        </div>
      )}

      {/* Game Over overlay */}
      {gameOver && !raceFinished && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="text-center">
            <h2 className="text-5xl font-bold text-destructive mb-4">차량 파괴!</h2>
            <p className="text-xl text-muted-foreground mb-8">충돌로 인해 차량이 파괴되었습니다</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-8 py-4 bg-primary text-primary-foreground rounded-lg text-xl font-bold hover:opacity-90 transition-opacity pointer-events-auto"
            >
              다시 시작 (R)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
