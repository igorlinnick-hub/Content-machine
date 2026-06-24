-- Scheduled posts: content that has been queued/scheduled to publish
-- via Buffer or directly. Each row = one piece of content, N channels.

CREATE TABLE IF NOT EXISTS scheduled_posts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id     UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  slide_set_id  UUID REFERENCES slide_sets(id) ON DELETE SET NULL,
  caption       TEXT NOT NULL DEFAULT '',
  media_url     TEXT,           -- cover image/video URL
  channels      TEXT[] NOT NULL DEFAULT '{}',   -- ['instagram','facebook','tiktok']
  scheduled_at  TIMESTAMPTZ,    -- null = draft/queue
  buffer_ids    JSONB DEFAULT '{}',  -- {instagram: 'buf_id', facebook: 'buf_id'}
  status        TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','scheduled','published','failed')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS scheduled_posts_clinic_id_idx ON scheduled_posts(clinic_id);
CREATE INDEX IF NOT EXISTS scheduled_posts_scheduled_at_idx ON scheduled_posts(scheduled_at);

-- Row-level security: admin can do anything; doctor can only read own clinic
ALTER TABLE scheduled_posts ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS; Next.js uses service key → no policy needed.
-- If you add user-level policies later, add them here.
