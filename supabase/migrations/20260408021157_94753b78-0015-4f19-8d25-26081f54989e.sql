
-- Create knowledge_base table for comprehensive training data
CREATE TABLE public.knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  data_type TEXT NOT NULL DEFAULT 'text',
  media_url TEXT,
  media_type TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

-- Admin-only access
CREATE POLICY "Admins can manage knowledge_base"
ON public.knowledge_base
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Service role needs access from edge functions
CREATE POLICY "Service role full access to knowledge_base"
ON public.knowledge_base
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Create index on category and data_type for faster queries
CREATE INDEX idx_knowledge_base_category ON public.knowledge_base(category);
CREATE INDEX idx_knowledge_base_data_type ON public.knowledge_base(data_type);
CREATE INDEX idx_knowledge_base_active ON public.knowledge_base(is_active);

-- Auto-update updated_at
CREATE TRIGGER update_knowledge_base_updated_at
BEFORE UPDATE ON public.knowledge_base
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
