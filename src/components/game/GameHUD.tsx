interface GameHUDProps {
  speed: number;
  lap: number;
  totalLaps?: number;
  boostAvailable?: boolean;
  boostActive?: boolean;
}

export const GameHUD = ({ speed, lap, totalLaps = 10, boostAvailable = true, boostActive = false }: GameHUDProps) => {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Speed + Boost stack */}
      <div className="absolute bottom-8 left-8 flex flex-col gap-2">
        {/* Boost indicator */}
        <div className="bg-card/80 backdrop-blur-sm rounded-lg p-3 border border-border">
          <div className="text-muted-foreground text-xs mb-1">Boost (Space)</div>
          {boostActive ? (
            <div className="text-lg font-bold text-orange-400 animate-pulse">🔥 Active!</div>
          ) : boostAvailable ? (
            <div className="text-lg font-bold text-primary">⚡ Ready</div>
          ) : (
            <div className="text-lg font-bold text-muted-foreground">✕ Used</div>
          )}
        </div>
        {/* Speed display */}
        <div className="bg-card/80 backdrop-blur-sm rounded-lg p-4 border border-primary/30">
          <div className="text-muted-foreground text-sm mb-1">Speed</div>
          <div className="text-4xl font-bold text-primary font-mono">
            {Math.round(speed)}
            <span className="text-lg text-muted-foreground ml-1">km/h</span>
          </div>
        </div>
      </div>
      
      {/* Top-left info panel: Lap and Position */}
      <div className="absolute top-8 left-8 space-y-3">
        {/* Lap counter */}
        <div className="bg-card/80 backdrop-blur-sm rounded-lg p-4 border border-accent/30">
          <div className="text-muted-foreground text-sm mb-1">Lap</div>
          <div className="text-2xl font-bold text-accent font-mono">
            {lap}<span className="text-lg text-muted-foreground">/{totalLaps}</span>
          </div>
        </div>
        
        {/* Position display */}
        <div className="bg-card/80 backdrop-blur-sm rounded-lg p-4 border border-secondary/30">
          <div className="text-muted-foreground text-sm mb-1">Position</div>
          <div className="text-2xl font-bold text-secondary font-mono">
            {position}
            <span className="text-lg text-muted-foreground">/{totalCars}</span>
          </div>
        </div>
      </div>
      
      {/* Controls hint */}
      <div className="absolute bottom-8 right-8 bg-card/80 backdrop-blur-sm rounded-lg p-4 border border-border">
        <div className="text-muted-foreground text-xs space-y-1">
          <div>↑ / W - Accelerate</div>
          <div>↓ / S - Reverse</div>
          <div>← / A - Turn Left</div>
          <div>→ / D - Turn Right</div>
          <div>Space - Boost</div>
          <div className="text-primary font-bold mt-2">R - Restart</div>
        </div>
      </div>
    </div>
  );
};