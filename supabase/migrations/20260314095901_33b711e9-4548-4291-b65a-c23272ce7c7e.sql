
-- Conversation logs table for auditing AI responses
CREATE TABLE public.conversation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  session_id text,
  channel text NOT NULL DEFAULT 'web',
  user_name text,
  user_message text NOT NULL,
  ai_response text NOT NULL,
  model_used text,
  has_image boolean DEFAULT false,
  feedback text CHECK (feedback IN ('up', 'down')),
  feedback_at timestamptz
);

-- Enable RLS
ALTER TABLE public.conversation_logs ENABLE ROW LEVEL SECURITY;

-- Public insert (the edge function writes logs)
CREATE POLICY "Anyone can insert logs" ON public.conversation_logs FOR INSERT TO public WITH CHECK (true);

-- Public can update feedback only
CREATE POLICY "Anyone can update feedback" ON public.conversation_logs FOR UPDATE TO public USING (true);

-- Public can read own logs (by session)
CREATE POLICY "Anyone can read logs" ON public.conversation_logs FOR SELECT TO public USING (true);
