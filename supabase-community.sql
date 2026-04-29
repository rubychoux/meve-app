-- Community: posts + public image bucket (run in Supabase SQL Editor)
-- Adjust table/column names if your project already defines `posts` differently.

-- ─── posts ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS posts_user_id_idx ON public.posts (user_id);
CREATE INDEX IF NOT EXISTS posts_created_at_idx ON public.posts (created_at DESC);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read posts" ON public.posts;
DROP POLICY IF EXISTS "Users insert own posts" ON public.posts;
DROP POLICY IF EXISTS "Users update own posts" ON public.posts;
DROP POLICY IF EXISTS "Users delete own posts" ON public.posts;

CREATE POLICY "Anyone can read posts"
  ON public.posts FOR SELECT
  USING (true);

CREATE POLICY "Users insert own posts"
  ON public.posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own posts"
  ON public.posts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own posts"
  ON public.posts FOR DELETE
  USING (auth.uid() = user_id);

-- ─── Storage: public bucket for post images ─────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('community-images', 'community-images', true)
ON CONFLICT (id) DO NOTHING;

-- Authenticated users can upload to their own folder: community-images/<uid>/...
DROP POLICY IF EXISTS "Public read community images" ON storage.objects;
DROP POLICY IF EXISTS "Users upload own community images" ON storage.objects;
DROP POLICY IF EXISTS "Users update own community images" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own community images" ON storage.objects;

CREATE POLICY "Public read community images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'community-images');

CREATE POLICY "Users upload own community images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'community-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users update own community images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'community-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users delete own community images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'community-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
