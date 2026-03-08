import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
};

interface LeaderboardEntry {
  id: string;
  name: string;
  best_lap_time: number;
  total_laps: number;
  created_at: string;
}

export const Leaderboard = () => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      const { data, error } = await supabase
        .from('leaderboard')
        .select('*')
        .order('best_lap_time', { ascending: true })
        .limit(10);
      
      if (!error && data) {
        setEntries(data);
      }
      setLoading(false);
    };
    fetchLeaderboard();
  }, []);

  return (
    <div className="bg-card/80 rounded-xl border border-border p-4 w-full max-w-md">
      <h3 className="text-lg font-bold text-primary mb-3 text-center">🏆 Leaderboard</h3>
      {loading ? (
        <p className="text-sm text-muted-foreground text-center">Loading...</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center">No records yet. Be the first!</p>
      ) : (
        <div className="flex flex-col gap-1">
          <div className="flex justify-between px-3 py-1 text-xs text-muted-foreground font-semibold">
            <span className="w-8">#</span>
            <span className="flex-1">Name</span>
            <span className="w-20 text-right">Best Lap</span>
            <span className="w-12 text-right">Laps</span>
          </div>
          {entries.map((entry, i) => (
            <div
              key={entry.id}
              className={`flex justify-between items-center px-3 py-1.5 rounded-md ${
                i === 0 ? 'bg-primary/10' : i % 2 === 0 ? 'bg-muted/30' : ''
              }`}
            >
              <span className="w-8 text-sm font-bold text-muted-foreground">
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
              </span>
              <span className="flex-1 text-sm font-semibold text-foreground truncate">{entry.name}</span>
              <span className="w-20 text-right text-sm font-mono font-bold text-primary">
                {formatTime(entry.best_lap_time)}
              </span>
              <span className="w-12 text-right text-xs text-muted-foreground">{entry.total_laps}L</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

interface SubmitScoreProps {
  bestLapTime: number;
  totalLaps: number;
  onSubmitted: () => void;
}

export const SubmitScore = ({ bestLapTime, totalLaps, onSubmitted }: SubmitScoreProps) => {
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    
    const { error } = await supabase
      .from('leaderboard')
      .insert({
        name: name.trim(),
        best_lap_time: bestLapTime,
        total_laps: totalLaps,
      });

    if (!error) {
      setSubmitted(true);
      onSubmitted();
    }
    setSubmitting(false);
  };

  if (submitted) {
    return <p className="text-sm text-primary font-semibold">✅ Score submitted!</p>;
  }

  return (
    <div className="flex gap-2 items-center justify-center">
      <input
        type="text"
        maxLength={10}
        placeholder="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        className="px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm w-32 text-center focus:outline-none focus:border-primary"
      />
      <button
        onClick={handleSubmit}
        disabled={!name.trim() || submitting}
        className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50 pointer-events-auto"
      >
        {submitting ? '...' : 'Submit'}
      </button>
    </div>
  );
};
