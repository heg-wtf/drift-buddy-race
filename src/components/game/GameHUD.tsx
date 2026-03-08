interface GameHUDProps {
  speed: number;
  position: number;
  totalCars: number;
  lap: number;
}

export const GameHUD = ({ speed, position, totalCars, lap }: GameHUDProps) => {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Speed display */}
      <div className="absolute bottom-8 left-8 bg-card/80 backdrop-blur-sm rounded-lg p-4 border border-primary/30">
        <div className="text-muted-foreground text-sm mb-1">속도</div>
        <div className="text-4xl font-bold text-primary font-mono">
          {Math.round(speed)}
          <span className="text-lg text-muted-foreground ml-1">km/h</span>
        </div>
      </div>
      
      {/* Position display */}
      <div className="absolute top-8 right-8 bg-card/80 backdrop-blur-sm rounded-lg p-4 border border-secondary/30">
        <div className="text-muted-foreground text-sm mb-1">순위</div>
        <div className="text-4xl font-bold text-secondary font-mono">
          {position}
          <span className="text-lg text-muted-foreground">/{totalCars}</span>
        </div>
      </div>
      
      {/* Lap counter */}
      <div className="absolute top-8 left-8 bg-card/80 backdrop-blur-sm rounded-lg p-4 border border-accent/30">
        <div className="text-muted-foreground text-sm mb-1">랩</div>
        <div className="text-2xl font-bold text-accent font-mono">
          {lap}
        </div>
      </div>
      
      {/* Controls hint */}
      <div className="absolute bottom-8 right-8 bg-card/80 backdrop-blur-sm rounded-lg p-4 border border-border">
        <div className="text-muted-foreground text-xs space-y-1">
          <div>↑ / W - 가속</div>
          <div>↓ / S - 후진</div>
          <div>← / A - 좌회전</div>
          <div>→ / D - 우회전</div>
        </div>
      </div>
    </div>
  );
};
