
-- Create whatsapp_profiles table for multi-account support
CREATE TABLE public.whatsapp_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  server_url TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  phone_number TEXT,
  status TEXT NOT NULL DEFAULT 'disconnected',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage whatsapp_profiles"
ON public.whatsapp_profiles
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role full access to whatsapp_profiles"
ON public.whatsapp_profiles
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE TRIGGER update_whatsapp_profiles_updated_at
BEFORE UPDATE ON public.whatsapp_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for knowledge base media
INSERT INTO storage.buckets (id, name, public) VALUES ('knowledge-media', 'knowledge-media', true);

CREATE POLICY "Anyone can view knowledge media"
ON storage.objects FOR SELECT
USING (bucket_id = 'knowledge-media');

CREATE POLICY "Admins can upload knowledge media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'knowledge-media' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update knowledge media"
ON storage.objects FOR UPDATE
USING (bucket_id = 'knowledge-media' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete knowledge media"
ON storage.objects FOR DELETE
USING (bucket_id = 'knowledge-media' AND has_role(auth.uid(), 'admin'::app_role));
