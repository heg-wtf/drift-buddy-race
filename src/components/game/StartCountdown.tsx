import { useState, useEffect } from 'react';

interface StartCountdownProps {
  onStart: () => void;
  onBeep?: (final: boolean) => void;
}

export const StartCountdown = ({ onStart, onBeep }: StartCountdownProps) => {
  const [phase, setPhase] = useState(0); // 0=waiting, 1-5=lights, 6=GO, 7=hidden
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    
    // Light up each light with 1s interval
    for (let i = 1; i <= 5; i++) {
      timers.push(setTimeout(() => {
        setPhase(i);
        onBeep?.(false);
      }, i * 1000));
    }
    
    // All lights off = GO!
    timers.push(setTimeout(() => {
      setPhase(6);
      onBeep?.(true);
      onStart();
    }, 6500));
    
    // Hide after GO
    timers.push(setTimeout(() => {
      setVisible(false);
    }, 8000));

    return () => timers.forEach(clearTimeout);
  }, [onStart, onBeep]);

  if (!visible) return null;

  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-50">
      <div className="flex flex-col items-center">
        {/* F1-style light panel */}
        <div className="bg-card/90 backdrop-blur-sm rounded-2xl p-6 border border-border">
          <div className="flex gap-4">
            {[1, 2, 3, 4, 5].map((light) => (
              <div
                key={light}
                className="w-10 h-10 rounded-full border-2 transition-all duration-200"
                style={{
                  borderColor: 'hsl(var(--border))',
                  backgroundColor: phase >= light && phase < 6
                    ? 'hsl(0, 85%, 50%)'
                    : phase === 6
                    ? 'hsl(145, 80%, 45%)'
                    : 'hsl(var(--muted))',
                  boxShadow: phase >= light && phase < 6
                    ? '0 0 20px hsl(0, 85%, 50%)'
                    : phase === 6
                    ? '0 0 20px hsl(145, 80%, 45%)'
                    : 'none',
                }}
              />
            ))}
          </div>
        </div>

        {/* GO text */}
        {phase === 6 && (
          <div className="text-6xl font-bold text-primary mt-6 animate-pulse"
               style={{ textShadow: '0 0 30px hsl(var(--primary))' }}>
            GO!
          </div>
        )}
        
        {phase === 0 && (
          <div className="text-xl text-muted-foreground mt-4">
            준비하세요...
          </div>
        )}
      </div>
    </div>
  );
};
