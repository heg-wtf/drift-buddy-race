import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment, Stars } from '@react-three/drei';
import { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Car } from './Car';
import { Track } from './Track';
import { GameHUD } from './GameHUD';

const AI_COLORS = ['#ff6b6b', '#4ecdc4', '#ffe66d', '#95e1d3'];

const FollowCamera = ({ target }: { target: THREE.Vector3 | null }) => {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  
  useEffect(() => {
    if (cameraRef.current && target) {
      const offset = new THREE.Vector3(0, 8, -12);
      cameraRef.current.position.copy(target).add(offset);
      cameraRef.current.lookAt(target);
    }
  }, [target]);
  
  return (
    <PerspectiveCamera
      ref={cameraRef}
      makeDefault
      position={[0, 15, -20]}
      fov={60}
    />
  );
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
  const [cameraTarget, setCameraTarget] = useState<THREE.Vector3 | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
  }, []);

  const handlePlayerUpdate = (position: THREE.Vector3, rotation: number, currentSpeed: number) => {
    setPlayerPosition(position);
    setPlayerRotation(rotation);
    setSpeed(currentSpeed);
    
    // Update camera target with smooth offset
    const offset = new THREE.Vector3(
      -Math.sin(rotation) * 12,
      8,
      -Math.cos(rotation) * 12
    );
    setCameraTarget(position.clone());
  };

  return (
    <div className="w-full h-screen bg-background relative">
      <Canvas shadows>
        <FollowCamera target={cameraTarget} />
        
        {/* Lighting */}
        <ambientLight intensity={0.3} />
        <directionalLight
          position={[50, 50, 25]}
          intensity={1}
          castShadow
          shadow-mapSize={[2048, 2048]}
        />
        <pointLight position={[0, 20, 0]} intensity={0.5} color="#00ffcc" />
        
        {/* Environment */}
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        <fog attach="fog" args={['#0a0a1a', 30, 100]} />
        
        {/* Track */}
        <Track radius={25} width={12} />
        
        {/* Player car */}
        <Car
          position={[25, 0, 0]}
          color="#00ffcc"
          isPlayer
          controls={controls}
          onUpdate={handlePlayerUpdate}
          trackRadius={25}
        />
        
        {/* AI cars */}
        {AI_COLORS.map((color, index) => (
          <Car
            key={index}
            position={[
              Math.sin((index + 1) * Math.PI / 2.5) * 25,
              0,
              Math.cos((index + 1) * Math.PI / 2.5) * 25
            ]}
            color={color}
            trackRadius={25}
            aiIndex={index}
          />
        ))}
        
        <OrbitControls enabled={false} />
      </Canvas>
      
      <GameHUD
        speed={speed}
        position={1}
        totalCars={5}
        lap={1}
      />
    </div>
  );
};
