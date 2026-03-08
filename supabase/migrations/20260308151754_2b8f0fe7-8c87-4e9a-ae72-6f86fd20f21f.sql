
-- Create leaderboard table
CREATE TABLE public.leaderboard (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL CHECK (char_length(name) <= 10),
  best_lap_time NUMERIC NOT NULL,
  total_laps INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.leaderboard ENABLE ROW LEVEL SECURITY;

-- Anyone can read leaderboard
CREATE POLICY "Leaderboard is publicly readable"
  ON public.leaderboard FOR SELECT
  TO anon, authenticated
  USING (true);

-- Anyone can insert (no auth required for a game)
CREATE POLICY "Anyone can submit scores"
  ON public.leaderboard FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
