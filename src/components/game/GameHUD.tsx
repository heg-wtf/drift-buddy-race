interface GameHUDProps {
  speed: number;
  position: number;
  totalCars: number;
  lap: number;
  totalLaps?: number;
  damage?: number;
}

export const GameHUD = ({ speed, position, totalCars, lap, totalLaps = 10, damage = 0 }: GameHUDProps) => {
  const damageColor = damage > 70 ? 'text-destructive' : damage > 40 ? 'text-accent' : 'text-primary';
  
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

      {/* Damage display */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-card/80 backdrop-blur-sm rounded-lg p-4 border border-destructive/30">
        <div className="text-muted-foreground text-sm mb-1">차량 상태</div>
        <div className="w-48 h-4 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full transition-all duration-300"
            style={{ 
              width: `${100 - damage}%`,
              backgroundColor: damage > 70 ? 'hsl(var(--destructive))' : damage > 40 ? 'hsl(var(--accent))' : 'hsl(var(--primary))'
            }}
          />
        </div>
        <div className={`text-center text-sm font-bold mt-1 ${damageColor}`}>
          {Math.round(100 - damage)}%
        </div>
      </div>
      
      {/* Top-left info panel: Lap and Position */}
      <div className="absolute top-8 left-8 space-y-3">
        {/* Lap counter */}
        <div className="bg-card/80 backdrop-blur-sm rounded-lg p-4 border border-accent/30">
          <div className="text-muted-foreground text-sm mb-1">랩</div>
          <div className="text-2xl font-bold text-accent font-mono">
            {lap}<span className="text-lg text-muted-foreground">/{totalLaps}</span>
          </div>
        </div>
        
        {/* Position display */}
        <div className="bg-card/80 backdrop-blur-sm rounded-lg p-4 border border-secondary/30">
          <div className="text-muted-foreground text-sm mb-1">순위</div>
          <div className="text-2xl font-bold text-secondary font-mono">
            {position}
            <span className="text-lg text-muted-foreground">/{totalCars}</span>
          </div>
        </div>
      </div>

      {/* Damage warning */}
      {damage > 50 && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className={`text-2xl font-bold animate-pulse ${damage > 70 ? 'text-destructive' : 'text-accent'}`}>
            {damage > 70 ? '⚠️ 심각한 손상!' : '⚠️ 차량 손상'}
          </div>
        </div>
      )}
      
      {/* Controls hint */}
      <div className="absolute bottom-8 right-8 bg-card/80 backdrop-blur-sm rounded-lg p-4 border border-border">
        <div className="text-muted-foreground text-xs space-y-1">
          <div>↑ / W - 가속</div>
          <div>↓ / S - 후진</div>
          <div>← / A - 좌회전</div>
          <div>→ / D - 우회전</div>
          <div className="text-primary font-bold mt-2">R - 재시작</div>
        </div>
      </div>
    </div>
  );
};
