CREATE TABLE IF NOT EXISTS google_reviews_cache (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  google_review_id TEXT UNIQUE NOT NULL,
  author_name      TEXT NOT NULL,
  author_url       TEXT,
  profile_photo    TEXT,
  rating           INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  text             TEXT,
  time             BIGINT,
  relative_time    TEXT,
  language         TEXT DEFAULT 'tr',
  is_visible       BOOLEAN DEFAULT TRUE,
  fetched_at       TIMESTAMPTZ DEFAULT NOW(),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE google_reviews_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view visible google reviews"
  ON google_reviews_cache FOR SELECT
  USING (is_visible = TRUE);

CREATE INDEX IF NOT EXISTS idx_google_reviews_visible
  ON google_reviews_cache(is_visible, time DESC);

CREATE TABLE IF NOT EXISTS google_place_cache (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  place_id        TEXT NOT NULL,
  total_rating    NUMERIC(3,2),
  total_reviews   INTEGER,
  last_fetched_at TIMESTAMPTZ DEFAULT NOW(),
  raw_response    JSONB
);

ALTER TABLE google_place_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view place cache"
  ON google_place_cache FOR SELECT
  USING (true);

CREATE INDEX IF NOT EXISTS idx_google_place_fetched
  ON google_place_cache(last_fetched_at DESC);
