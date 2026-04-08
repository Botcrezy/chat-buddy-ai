
-- Customer Memory table
CREATE TABLE public.customer_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  memory_type text NOT NULL DEFAULT 'note',
  key text NOT NULL,
  value text NOT NULL,
  extracted_from_message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  created_by text NOT NULL DEFAULT 'ai',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage customer_memory" ON public.customer_memory
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_customer_memory_updated_at
  BEFORE UPDATE ON public.customer_memory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Broadcast Campaigns table
CREATE TABLE public.broadcast_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  media_url text,
  media_type text,
  target_category text DEFAULT 'all',
  status text NOT NULL DEFAULT 'draft',
  total_recipients integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.broadcast_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage broadcast_campaigns" ON public.broadcast_campaigns
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_broadcast_campaigns_updated_at
  BEFORE UPDATE ON public.broadcast_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Broadcast Recipients table
CREATE TABLE public.broadcast_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.broadcast_campaigns(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  sent_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.broadcast_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage broadcast_recipients" ON public.broadcast_recipients
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Followup Rules table
CREATE TABLE public.followup_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  trigger_type text NOT NULL DEFAULT 'no_reply',
  delay_hours integer NOT NULL DEFAULT 24,
  message_template text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  target_category text DEFAULT 'all',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.followup_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage followup_rules" ON public.followup_rules
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_followup_rules_updated_at
  BEFORE UPDATE ON public.followup_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add WhatsApp profile columns to contacts
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS whatsapp_name text,
  ADD COLUMN IF NOT EXISTS whatsapp_about text,
  ADD COLUMN IF NOT EXISTS whatsapp_avatar_url text,
  ADD COLUMN IF NOT EXISTS summary text;
